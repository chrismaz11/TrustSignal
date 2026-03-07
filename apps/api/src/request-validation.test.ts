import { randomUUID } from 'crypto';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

import { buildServer } from './server.js';

const prisma = new PrismaClient();

describe('Request validation hardening', () => {
  let app: FastifyInstance;
  const apiKey = 'test-validation-api-key';
  const validReceiptId = randomUUID();

  beforeAll(async () => {
    app = await buildServer();
    await prisma.organization.upsert({
      where: { apiKey },
      create: {
        name: 'Validation Test Org',
        adminEmail: 'validation@test.local',
        apiKey
      },
      update: {}
    });
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { apiKey }
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects invalid receiptId params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/receipt/invalid$id',
      headers: { 'x-api-key': apiKey }
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects request bodies on no-body mutation routes', async () => {
    const verifyRes = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${validReceiptId}/verify`,
      headers: { 'x-api-key': apiKey },
      payload: { force: true }
    });

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

    expect(verifyRes.statusCode).toBe(400);
    expect(anchorRes.statusCode).toBe(400);
    expect(revokeRes.statusCode).toBe(400);
  });
});
