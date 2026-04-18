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

describeWithDatabase('E2E /api/v1/anchor/:receiptId via curl', () => {
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
      'RPC_URL',
      'REGISTRY_ADDRESS'
    ]);

    process.env.API_KEYS = 'e2e-read,e2e-verify,e2e-anchor';
    process.env.API_KEY_SCOPES = 'e2e-read=read;e2e-verify=verify|read;e2e-anchor=anchor';
    process.env.RATE_LIMIT_GLOBAL_MAX = '500';
    process.env.RATE_LIMIT_API_KEY_MAX = '500';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    process.env.RPC_URL = 'https://rpc.sepolia.dev';
    process.env.REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890';

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

  it('should successfully anchor a receipt', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(200);
    expect(anchor.body?.status).toBe('ANCHORED');
    expect(typeof anchor.body?.txHash).toBe('string');
  });

  it('should return 403 when anchoring without proper scope', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-read'
    );
    expect(anchor.status).toBe(403);
  });

  it('should return 404 when anchoring non-existent receipt', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/00000000-0000-0000-0000-000000000000`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(404);
  });

  it('should return 409 when anchoring without proof artifact', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(409);
  });

  it('should return ALREADY_ANCHORED when anchoring twice', async () => {
    const firstAnchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(firstAnchor.status).toBe(200);

    const secondAnchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(secondAnchor.status).toBe(200);
    expect(secondAnchor.body?.status).toBe('ANCHORED');
  });

  it('should verify anchor status in receipt GET', async () => {
    const getReceipt = await curlJson(
      `${baseUrl}/api/v1/receipt/${testReceiptId}`, 
      'GET',
      undefined,
      'e2e-read'
    );
    expect(getReceipt.status).toBe(200);
    expect(getReceipt.body?.anchorStatus).toBe('ANCHORED');
  });

  it('should handle RPC timeout gracefully', async () => {
    process.env.RPC_URL = 'http://invalid-rpc-url';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should handle RPC connection failure', async () => {
    process.env.RPC_URL = 'http://localhost:9999';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should handle transaction rejection', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should reject anchoring with invalid RPC URL', async () => {
    process.env.RPC_URL = 'invalid-url';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should reject anchoring with missing RPC config', async () => {
    process.env.RPC_URL = '';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should reject anchoring with invalid contract address', async () => {
    process.env.REGISTRY_ADDRESS = 'invalid-address';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should reject anchoring with missing contract address', async () => {
    process.env.REGISTRY_ADDRESS = '';
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      undefined,
      'e2e-anchor'
    );
    expect(anchor.status).toBe(500);
  });

  it('should reject anchoring with body content', async () => {
    const anchor = await curlJson(
      `${baseUrl}/api/v1/anchor/${testReceiptId}`, 
      'POST',
      { invalid: 'body' },
      'e2e-anchor'
    );
    expect(anchor.status).toBe(400);
  });
});
