import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sign, type JwtPayload } from 'jsonwebtoken';
import type { FastifyInstance } from 'fastify';
import type { VerificationRecord } from '@prisma/client';

import { buildApiServer } from '../../src/routes/app.js';
import type { RouteDependencies } from '../../src/routes/dependencies.js';
import type { VerifyBundleInput } from '../../src/types/VerificationResult.js';
import type {
  CreateVerificationRecordInput,
  RevokeVerificationRecordInput,
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
    process.env.TRUSTSIGNAL_JWT_SECRET = JWT_SECRET;

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
    delete process.env.TRUSTSIGNAL_JWT_SECRET;
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
