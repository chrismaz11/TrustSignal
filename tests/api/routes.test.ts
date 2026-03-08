import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sign, type JwtPayload } from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';

import { buildApiServer } from '../../src/routes/app.js';
import type { RouteDependencies } from '../../src/routes/dependencies.js';
import type { VerifyBundleInput } from '../../src/types/VerificationResult.js';
import type {
  CreateVerificationRecordInput,
  RevokeVerificationRecordInput,
  VerificationRecord,
  VerificationRecordStore
} from '../../src/storage/verificationRecordStore.js';

const JWT_SECRET = 'test-secret';

class InMemoryVerificationRecordStore implements VerificationRecordStore {
  private readonly records = new Map<string, VerificationRecord>();
  private idCounter = 1;

  async create(input: CreateVerificationRecordInput): Promise<VerificationRecord> {
    const now = new Date();
    const record: VerificationRecord = {
      id: `record-${this.idCounter}`,
      bundleHash: input.bundleHash,
      nonMemOk: input.nonMemOk,
      revocationOk: input.revocationOk,
      zkmlOk: input.zkmlOk,
      fraudScore: input.fraudScore,
      proofGenMs: input.proofGenMs,
      timestamp: input.timestamp,
      revoked: false,
      revocationReason: null,
      revocationTxHash: null,
      revokedAt: null,
      createdAt: now,
      updatedAt: now
    };

    this.idCounter += 1;
    this.records.set(record.bundleHash, record);
    return record;
  }

  async findByBundleHash(bundleHash: string): Promise<VerificationRecord | null> {
    return this.records.get(bundleHash) ?? null;
  }

  async revokeByBundleHash(
    bundleHash: string,
    input: RevokeVerificationRecordInput
  ): Promise<VerificationRecord | null> {
    const record = this.records.get(bundleHash);
    if (!record) {
      return null;
    }

    const updatedRecord: VerificationRecord = {
      ...record,
      revoked: true,
      revocationReason: input.reason,
      revocationTxHash: input.txHash,
      revokedAt: input.revokedAt,
      updatedAt: new Date()
    };

    this.records.set(bundleHash, updatedRecord);
    return updatedRecord;
  }
}

function createJwt(claims: JwtPayload = {}): string {
  return sign(claims, JWT_SECRET, { expiresIn: '1h' });
}

function buildVerifyBody(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    deed_hash: 'bundle-001',
    text_length: 4200,
    num_signatures: 2,
    notary_present: true,
    days_since_notarized: 4,
    amount: 350000,
    ...overrides
  };
}

describe('Fastify verification routes', () => {
  let app: FastifyInstance;
  let store: InMemoryVerificationRecordStore;
  let verifyBundleMock: RouteDependencies['verifyBundle'];
  let anchorNullifierMock: RouteDependencies['anchorNullifier'];

  beforeEach(async () => {
    const envSnapshot = {
      TRUSTSIGNAL_JWT_SECRET: process.env.TRUSTSIGNAL_JWT_SECRET,
      TRUSTSIGNAL_JWT_SECRETS: process.env.TRUSTSIGNAL_JWT_SECRETS,
      LOG_LEVEL: process.env.LOG_LEVEL
    };
    (globalThis as typeof globalThis & { __routesTestEnvSnapshot?: typeof envSnapshot }).__routesTestEnvSnapshot = envSnapshot;
    process.env.TRUSTSIGNAL_JWT_SECRET = JWT_SECRET;
    process.env.TRUSTSIGNAL_JWT_SECRETS = JWT_SECRET;
    process.env.LOG_LEVEL = 'silent';

    store = new InMemoryVerificationRecordStore();
    verifyBundleMock = vi.fn(async (input: VerifyBundleInput) => {
      const amountFeature = input.deed_features[4] ?? 0;
      const fraudScore = amountFeature > 1 ? 0.97 : 0.12;

      return {
        non_mem_ok: true,
        revocation_ok: true,
        zkml_ok: true,
        fraud_score: fraudScore,
        proof_gen_ms: 1506,
        timestamp: '2026-03-02T00:00:00.000Z',
        bundle_hash: input.bundle_hash ?? 'fallback-bundle-hash'
      };
    });

    anchorNullifierMock = vi.fn(async () => ({
      tx_hash: '0xtesttxhash',
      timestamp: '2026-03-02T01:00:00.000Z',
      nullifier_hash: '0xnullifier'
    }));

    app = await buildApiServer({
      deps: {
        verifyBundle: verifyBundleMock,
        recordStore: store,
        anchorNullifier: anchorNullifierMock
      }
    });
  });

  afterEach(async () => {
    await app.close();
    const envSnapshot = (globalThis as typeof globalThis & {
      __routesTestEnvSnapshot?: {
        TRUSTSIGNAL_JWT_SECRET?: string;
        TRUSTSIGNAL_JWT_SECRETS?: string;
        LOG_LEVEL?: string;
      };
    }).__routesTestEnvSnapshot;
    if (envSnapshot?.TRUSTSIGNAL_JWT_SECRET === undefined) {
      delete process.env.TRUSTSIGNAL_JWT_SECRET;
    } else {
      process.env.TRUSTSIGNAL_JWT_SECRET = envSnapshot.TRUSTSIGNAL_JWT_SECRET;
    }
    if (envSnapshot?.TRUSTSIGNAL_JWT_SECRETS === undefined) {
      delete process.env.TRUSTSIGNAL_JWT_SECRETS;
    } else {
      process.env.TRUSTSIGNAL_JWT_SECRETS = envSnapshot.TRUSTSIGNAL_JWT_SECRETS;
    }
    if (envSnapshot?.LOG_LEVEL === undefined) {
      delete process.env.LOG_LEVEL;
    } else {
      process.env.LOG_LEVEL = envSnapshot.LOG_LEVEL;
    }
  });

  it('returns 401 when auth header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      payload: buildVerifyBody()
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
  });

  it('returns 401 when token is invalid', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: 'Bearer invalid-token'
      },
      payload: buildVerifyBody()
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().message).toBe('Invalid or expired token');
  });

  it('verifies bundle and returns CombinedResult with record_id', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody()
    });

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(payload.bundle_hash).toBe('bundle-001');
    expect(payload.zkml_ok).toBe(true);
    expect(payload.record_id).toBe('record-1');
  });

  it('returns high fraud score for risky verify payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({
        amount: 1_500_000
      })
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().fraud_score).toBe(0.97);
  });

  it('handles non-hex deed_hash by mapping hash signal to 0', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({
        deed_hash: '!!!!@@@@'
      })
    });

    expect(response.statusCode).toBe(200);
    expect(vi.mocked(verifyBundleMock)).toHaveBeenCalled();
    const firstCall = vi.mocked(verifyBundleMock).mock.calls.at(0);
    expect(firstCall?.[0].deed_features[5]).toBe(0);
  });

  it('handles parseInt failure in hash signal path safely', async () => {
    const parseIntSpy = vi.spyOn(Number, 'parseInt').mockReturnValueOnce(Number.NaN);
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/verify-bundle',
        headers: {
          authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
        },
        payload: buildVerifyBody({
          deed_hash: 'abcdef12'
        })
      });

      expect(response.statusCode).toBe(200);
      const firstCall = vi.mocked(verifyBundleMock).mock.calls.at(0);
      expect(firstCall?.[0].deed_features[5]).toBe(0);
    } finally {
      parseIntSpy.mockRestore();
    }
  });

  it('returns 500 when verify dependency throws', async () => {
    vi.mocked(verifyBundleMock).mockRejectedValueOnce(new Error('verifier offline'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody()
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Verification failed',
      message: 'Unable to complete bundle verification'
    });
  });

  it('revokes a record with admin claim and returns tx hash', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-revoke-1' })
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'bundle-revoke-1',
        reason: 'Fraud investigation'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      revoked: true,
      tx_hash: '0xtesttxhash',
      timestamp: '2026-03-02T01:00:00.000Z'
    });
  });

  it('accepts revoke when JWT has admin=true claim', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-revoke-admin-flag' })
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', admin: true })}`
      },
      payload: {
        bundle_hash: 'bundle-revoke-admin-flag',
        reason: 'Admin override'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().revoked).toBe(true);
  });

  it('accepts revoke when JWT has roles array with admin entry', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-revoke-role-array' })
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', roles: ['viewer', 'ADMIN'] })}`
      },
      payload: {
        bundle_hash: 'bundle-revoke-role-array',
        reason: 'Policy enforcement'
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().revoked).toBe(true);
  });

  it('blocks revoke when caller lacks admin claim', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-revoke-2' })
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: {
        bundle_hash: 'bundle-revoke-2',
        reason: 'Unauthorized revocation attempt'
      }
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().message).toBe('Admin claim is required to revoke a bundle');
  });

  it('returns 404 when revoke target does not exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'missing-bundle',
        reason: 'Fraud investigation'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Verification record not found');
  });

  it('returns 400 for malformed revoke payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'bundle-invalid',
        reason: '  '
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Invalid request body');
  });

  it('returns 502 when anchor service returns invalid timestamp', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-invalid-anchor-ts' })
    });

    vi.mocked(anchorNullifierMock).mockResolvedValueOnce({
      tx_hash: '0xanchor',
      timestamp: 'not-a-timestamp',
      nullifier_hash: '0xnullifier'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'bundle-invalid-anchor-ts',
        reason: 'Malformed anchor response test'
      }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json().message).toBe('Anchor service returned an invalid timestamp');
  });

  it('returns 404 when revocation update finds no record', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-race-condition' })
    });

    vi.spyOn(store, 'revokeByBundleHash').mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'bundle-race-condition',
        reason: 'Race condition simulation'
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Verification record not found');
  });

  it('returns 502 when anchor dependency throws', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-anchor-error' })
    });

    vi.mocked(anchorNullifierMock).mockRejectedValueOnce(new Error('rpc timeout'));

    const response = await app.inject({
      method: 'POST',
      url: '/v1/revoke',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'admin-user', role: 'admin' })}`
      },
      payload: {
        bundle_hash: 'bundle-anchor-error',
        reason: 'Force upstream failure'
      }
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toEqual({
      error: 'Upstream Error',
      message: 'Failed to anchor revocation on Polygon Mumbai'
    });
  });

  it('returns status for existing bundle record', async () => {
    await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: buildVerifyBody({ deed_hash: 'bundle-status-1' })
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/status/bundle-status-1',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      bundle_hash: 'bundle-status-1',
      non_mem_ok: true,
      revocation_ok: true,
      zkml_ok: true
    });
  });

  it('returns 404 for unknown status bundle', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/status/non-existent-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      }
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().message).toBe('Verification record not found');
  });

  it('returns 400 for status request with whitespace bundleId', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/status/%20',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Invalid path parameter');
  });

  it('returns 500 when status lookup throws non-Error values', async () => {
    vi.spyOn(store, 'findByBundleHash').mockRejectedValueOnce('database unavailable');

    const response = await app.inject({
      method: 'GET',
      url: '/v1/status/bundle-db-error',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      }
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: 'Internal Server Error',
      message: 'Unable to fetch verification status'
    });
  });

  it('enforces 100 req/min per IP rate limit', async () => {
    const token = createJwt({ sub: 'partner-user' });

    for (let index = 0; index < 100; index += 1) {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/status/rate-limit-bundle',
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      expect(response.statusCode).toBe(404);
    }

    const blocked = await app.inject({
      method: 'GET',
      url: '/v1/status/rate-limit-bundle',
      headers: {
        authorization: `Bearer ${token}`
      }
    });

    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers.retryafter ?? blocked.headers['retry-after']).toBeDefined();
  });

  it('returns 400 for malformed verify body', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/verify-bundle',
      headers: {
        authorization: `Bearer ${createJwt({ sub: 'partner-user' })}`
      },
      payload: {
        deed_hash: 'bundle-malformed',
        text_length: 2000,
        num_signatures: 1,
        notary_present: true,
        days_since_notarized: 5
      }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe('Invalid request body');
  });
});
