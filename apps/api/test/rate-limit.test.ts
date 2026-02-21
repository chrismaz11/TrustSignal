import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('Rate Limiting', () => {
  let app: FastifyInstance;
  let testOrgId1: string;
  let testApiKey1 = 'test-key-rl-1';

  let testOrgId2: string;
  let testApiKey2 = 'test-key-rl-2';

  beforeAll(async () => {
    // We configure to a small limit so we can easily test
    app = await buildServer({ rateLimitMax: 2, rateLimitWindow: '1 minute' });
    
    // Create orgs
    const org1 = await prisma.organization.create({
      data: {
        name: 'Rate Limit Test Org 1',
        adminEmail: 'test1@rl.com',
        apiKey: testApiKey1,
        rateLimit: 1 // Override default
      }
    });
    testOrgId1 = org1.id;

    const org2 = await prisma.organization.create({
      data: {
        name: 'Rate Limit Test Org 2',
        adminEmail: 'test2@rl.com',
        apiKey: testApiKey2,
        rateLimit: null // Uses config default (2)
      }
    });
    testOrgId2 = org2.id;
  });

  afterAll(async () => {
    await prisma.requestLog.deleteMany({
      where: { organizationId: { in: [testOrgId1, testOrgId2] } }
    });
    await prisma.organization.deleteMany({
      where: { id: { in: [testOrgId1, testOrgId2] } }
    });
    await app.close();
    await prisma.$disconnect();
  });

  it('applies per-org overridden rate limit', async () => {
    // Org 1 has rateLimit of 1
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': testApiKey1 }
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': testApiKey1 }
    });
    expect(res2.statusCode).toBe(429);
    
    const body = JSON.parse(res2.payload);
    expect(body.error).toBe('Too Many Requests');
    expect(body.correlationId).toBeDefined();

    // Verify RequestLog was created for 429
    // Sleep briefly to ensure async log finishes
    await new Promise(r => setTimeout(r, 50));
    const logs = await prisma.requestLog.findMany({
      where: { organizationId: testOrgId1, status: 429 }
    });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].endpoint).toBe('/api/v1/receipts');
  });

  it('applies global default rate limit if no override', async () => {
    // Org 2 has default rate limit of 2 (passed to buildServer config)
    const res1 = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': testApiKey2 }
    });
    expect(res1.statusCode).toBe(200);

    const res2 = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': testApiKey2 }
    });
    expect(res2.statusCode).toBe(200);

    const res3 = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': testApiKey2 }
    });
    expect(res3.statusCode).toBe(429);
  });
});
