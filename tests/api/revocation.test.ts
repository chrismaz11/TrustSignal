import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from '../../apps/api/src/server.js';

const execFileAsync = promisify(execFile);

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

async function curlJson(url: string, method: 'GET' | 'POST', payload?: unknown, apiKey?: string) {
  const args = ['-sS', '-w', '\n%{http_code}', '-X', method, url];
  if (apiKey) args.push('-H', `x-api-key: ${apiKey}`);
  if (payload !== undefined) {
    args.push('-H', 'content-type: application/json', '--data', JSON.stringify(payload));
  }

  const { stdout } = await execFileAsync('curl', args);
  const splitAt = stdout.lastIndexOf('\n');
  const bodyText = splitAt >= 0 ? stdout.slice(0, splitAt) : stdout;
  const statusText = splitAt >= 0 ? stdout.slice(splitAt + 1).trim() : '0';
  const status = Number.parseInt(statusText, 10);
  const body = bodyText ? JSON.parse(bodyText) : null;
  return { status, body };
}

const databaseUrl =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_POOLER_URL ||
  process.env.SUPABASE_DIRECT_URL || '';
const hasDatabase =
  process.env.RUN_DB_E2E === '1' &&
  (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://'));
const describeWithDatabase = hasDatabase ? describe.sequential : describe.skip;

describeWithDatabase('E2E /api/v1/receipt/:receiptId/revoke via curl', () => {
  let app: FastifyInstance;
  let baseUrl = '';
  let envSnapshot: EnvSnapshot;
  let testReceiptId: string;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL =
        process.env.SUPABASE_DB_URL ||
        process.env.SUPABASE_POOLER_URL ||
        process.env.SUPABASE_DIRECT_URL || '';
    }

    envSnapshot = snapshotEnv([
      'API_KEYS',
      'API_KEY_SCOPES',
      'RATE_LIMIT_GLOBAL_MAX',
      'RATE_LIMIT_API_KEY_MAX',
      'RATE_LIMIT_WINDOW',
      'REVOCATION_ISSUERS'
    ]);

    process.env.API_KEYS = 'e2e-read,e2e-verify,e2e-revoke';
    process.env.API_KEY_SCOPES = 'e2e-read=read;e2e-verify=verify|read;e2e-revoke=revoke';
    process.env.RATE_LIMIT_GLOBAL_MAX = '500';
    process.env.RATE_LIMIT_API_KEY_MAX = '500';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    process.env.REVOCATION_ISSUERS = 'test-issuer=0x1234567890123456789012345678901234567890';

    app = await buildServer();
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind E2E server');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;

    // Create a test receipt
    const synthetic = await curlJson(`${baseUrl}/api/v1/synthetic`, 'GET', undefined, 'e2e-read');
    const verify = await curlJson(`${baseUrl}/api/v1/verify`, 'POST', synthetic.body, 'e2e-verify');
    testReceiptId = verify.body?.receiptId;
  });

  afterAll(async () => {
    if (app) await app.close();
    restoreEnv(envSnapshot);
  });

  it('should successfully revoke a receipt', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(200);
    expect(revoke.body?.status).toBe('REVOKED');
  });

  it('should return 403 when revoking without proper scope', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-read'
    );
    expect(revoke.status).toBe(403);
  });

  it('should return 404 when revoking non-existent receipt', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/00000000-0000-0000-0000-000000000000/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(404);
  });

  it('should return 403 when revoking without issuer signature', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(403);
  });

  it('should return ALREADY_REVOKED when revoking twice', async () => {
    const firstRevoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(firstRevoke.status).toBe(200);

    const secondRevoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(secondRevoke.status).toBe(200);
    expect(secondRevoke.body?.status).toBe('ALREADY_REVOKED');
  });

  it('should verify revocation status in receipt GET', async () => {
    const getReceipt = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}`, 
      'GET',
      undefined,
      'e2e-read'
    );
    expect(getReceipt.status).toBe(200);
    expect(getReceipt.body?.revoked).toBe(true);
  });

  it('should reject revocation with invalid issuer', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(403);
  });

  it('should reject revocation with stale timestamp', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(403);
  });

  it('should reject revocation with invalid signature', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(403);
  });

  it('should reject revocation with missing headers', async () => {
    const revoke = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}/revoke`, 
      'POST',
      undefined,
      'e2e-revoke'
    );
    expect(revoke.status).toBe(403);
  });
});
