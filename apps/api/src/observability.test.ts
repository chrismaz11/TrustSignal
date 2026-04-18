import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';

import { buildServer } from './server.js';

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

const keysToSnapshot = [
  'API_KEYS',
  'API_KEY_SCOPES',
  'REVOCATION_ISSUERS',
  'RATE_LIMIT_GLOBAL_MAX',
  'RATE_LIMIT_API_KEY_MAX',
  'RATE_LIMIT_WINDOW'
];

describe.sequential('observability: correlation IDs and metrics endpoint', () => {
  let app: FastifyInstance;
  let envSnapshot: EnvSnapshot;

  beforeAll(async () => {
    envSnapshot = snapshotEnv(keysToSnapshot);
    process.env.API_KEYS = 'obs-test-key';
    process.env.API_KEY_SCOPES = 'obs-test-key=read';
    process.env.RATE_LIMIT_GLOBAL_MAX = '200';
    process.env.RATE_LIMIT_API_KEY_MAX = '200';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(envSnapshot);
  });

  it('returns x-request-id header on health endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(response.statusCode).toBe(200);
    const requestId = response.headers['x-request-id'];
    expect(requestId).toBeTypeOf('string');
    expect((requestId as string).length).toBeGreaterThan(0);
  });

  it('returns a distinct x-request-id for each request', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/health' });

    const idFirst = first.headers['x-request-id'];
    const idSecond = second.headers['x-request-id'];

    expect(idFirst).toBeTypeOf('string');
    expect(idSecond).toBeTypeOf('string');
    expect(idFirst).not.toBe(idSecond);
  });

  it('returns x-request-id header on metrics endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-request-id']).toBeTypeOf('string');
  });

  it('metrics endpoint exposes baseline HTTP request counters', async () => {
    // Trigger a request to populate metrics
    await app.inject({ method: 'GET', url: '/api/v1/health' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    const body = response.body;
    expect(body).toContain('trustsignal_http_requests_total');
    expect(body).toContain('trustsignal_http_request_duration_seconds');
  });

  it('metrics endpoint exposes business-level verification lifecycle counters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics'
    });

    expect(response.statusCode).toBe(200);
    const body = response.body;
    expect(body).toContain('trustsignal_receipts_issued_total');
    expect(body).toContain('trustsignal_receipt_verifications_total');
    expect(body).toContain('trustsignal_revocations_total');
    expect(body).toContain('trustsignal_verify_duration_seconds');
  });

  it('metrics endpoint exposes default Node.js process metrics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/metrics'
    });

    expect(response.statusCode).toBe(200);
    const body = response.body;
    // prom-client collectDefaultMetrics includes process_cpu_seconds_total
    expect(body).toContain('trustsignal_api_process_cpu_seconds_total');
  });

  it('x-request-id is consistent in header and not a sensitive value', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/status'
    });

    const requestId = response.headers['x-request-id'] as string;
    // Must be a string without obvious secret patterns (no Bearer, no sha256= etc.)
    expect(requestId).not.toMatch(/^(bearer|sha256=|eyJ)/i);
    expect(requestId.length).toBeLessThan(128);
  });
});
