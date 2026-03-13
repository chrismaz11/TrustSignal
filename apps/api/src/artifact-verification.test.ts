import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

import { buildServer } from './server.js';

const hasDatabaseUrl =
  Boolean(process.env.DATABASE_URL) ||
  Boolean(process.env.SUPABASE_DB_URL) ||
  Boolean(process.env.SUPABASE_POOLER_URL) ||
  Boolean(process.env.SUPABASE_DIRECT_URL);
const describeWithDatabase = hasDatabaseUrl ? describe.sequential : describe.skip;

describeWithDatabase('Generic artifact verification API', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;
  const apiKey = 'artifact-test-api-key';

  beforeAll(async () => {
    process.env.API_KEYS = apiKey;
    process.env.API_KEY_SCOPES = `${apiKey}=verify|read`;
    prisma = new PrismaClient();
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
  });

  it('issues, persists, and later verifies a generic artifact receipt', async () => {
    const artifactHash =
      '2f77668a9dfbf8d5847cf2d5d0370740e0c0601b4f061c1181f58c77c2b8f486';

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKey },
      payload: {
        artifact: {
          hash: artifactHash,
          algorithm: 'sha256'
        },
        source: {
          provider: 'github-actions',
          repository: 'TrustSignal-dev/TrustSignal-Verify-Artifact',
          workflow: 'Verify Build Artifact',
          runId: '12345',
          commit: 'abc123def456',
          actor: 'octocat'
        },
        metadata: {
          artifactPath: 'dist/release.txt'
        }
      }
    });

    expect(verifyRes.statusCode).toBe(200);
    const receipt = verifyRes.json();
    expect(receipt.status).toBe('verified');
    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.verificationId).toBe(receipt.receiptId);
    expect(typeof receipt.receiptSignature).toBe('string');

    const persistedRows = await prisma.$queryRawUnsafe<Array<{ receiptId: string }>>(
      `SELECT "receiptId" FROM "ArtifactReceipt" WHERE "receiptId" = $1`,
      receipt.receiptId
    );
    expect(persistedRows).toHaveLength(1);

    const laterVerifyMatch = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receipt.receiptId}/verify`,
      headers: { 'x-api-key': apiKey },
      payload: {
        artifact: {
          hash: artifactHash,
          algorithm: 'sha256'
        }
      }
    });

    expect(laterVerifyMatch.statusCode).toBe(200);
    expect(laterVerifyMatch.json()).toMatchObject({
      verified: true,
      integrityVerified: true,
      signatureVerified: true,
      status: 'verified',
      receiptId: receipt.receiptId,
      storedHash: artifactHash,
      recomputedHash: artifactHash
    });

    const laterVerifyMismatch = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receipt.receiptId}/verify`,
      headers: { 'x-api-key': apiKey },
      payload: {
        artifact: {
          hash: '1111111111111111111111111111111111111111111111111111111111111111',
          algorithm: 'sha256'
        }
      }
    });

    expect(laterVerifyMismatch.statusCode).toBe(200);
    expect(laterVerifyMismatch.json()).toMatchObject({
      verified: false,
      integrityVerified: false,
      status: 'mismatch',
      receiptId: receipt.receiptId
    });
  });
});
