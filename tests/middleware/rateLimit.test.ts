import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerRateLimit } from '../../src/middleware/rateLimit.js';

describe('rate limit middleware', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await registerRateLimit(app);

    app.get('/ok', async () => ({ ok: true }));
    app.get('/manual-429-default', async (_request, reply) => {
      return reply.code(429).send({ error: 'manual' });
    });
    app.get('/manual-429-retry-after', async (_request, reply) => {
      reply.header('retry-after', '12');
      return reply.code(429).send({ error: 'manual' });
    });
    app.get('/manual-429-retryAfter', async (_request, reply) => {
      reply.header('retryAfter', '99');
      return reply.code(429).send({ error: 'manual' });
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('does not inject retryAfter header for non-429 responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/ok'
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers.retryafter).toBeUndefined();
  });

  it('adds default retryAfter header for manual 429 responses', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/manual-429-default'
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers.retryafter).toBe('60');
  });

  it('maps retry-after to retryAfter when retryAfter is absent', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/manual-429-retry-after'
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers['retry-after']).toBe('12');
    expect(response.headers.retryafter).toBe('12');
  });

  it('preserves existing retryAfter header value', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/manual-429-retryAfter'
    });

    expect(response.statusCode).toBe(429);
    expect(response.headers.retryafter).toBe('99');
  });
});
