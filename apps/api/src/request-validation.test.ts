import { randomUUID } from 'crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';

import { buildServer } from './server.js';

describe('Request validation hardening', () => {
  let app: FastifyInstance;
  const apiKey = 'test-validation-api-key';
  const validReceiptId = randomUUID();
  const expectedStatusCode =
    Boolean(process.env.DATABASE_URL) ||
    Boolean(process.env.SUPABASE_DB_URL) ||
    Boolean(process.env.SUPABASE_POOLER_URL) ||
    Boolean(process.env.SUPABASE_DIRECT_URL)
      ? 400
      : 503;

  beforeAll(async () => {
    process.env.API_KEYS = apiKey;
    process.env.API_KEY_SCOPES = `${apiKey}=read|anchor|revoke`;
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
  });

  it('rejects invalid receiptId params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/receipt/invalid$id',
      headers: { 'x-api-key': apiKey }
    });

    expect(res.statusCode).toBe(expectedStatusCode);
  });

  it('rejects request bodies on no-body mutation routes', async () => {
    const anchorRes = await app.inject({
      method: 'POST',
      url: `/api/v1/anchor/${validReceiptId}`,
      headers: { 'x-api-key': apiKey },
      payload: { force: true }
    });

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${validReceiptId}/revoke`,
      headers: { 'x-api-key': apiKey },
      payload: { force: true }
    });

    expect(anchorRes.statusCode).toBe(expectedStatusCode);
    expect(revokeRes.statusCode).toBe(expectedStatusCode);
  });

  it('rejects invalid artifact verification payloads', async () => {
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${validReceiptId}/verify`,
      headers: { 'x-api-key': apiKey },
      payload: { artifact: { hash: 'invalid', algorithm: 'md5' } }
    });

    expect(verifyRes.statusCode).toBe(expectedStatusCode);
  });
});
