import type { FastifyInstance } from 'fastify';
import fastifyRateLimit from '@fastify/rate-limit';

const MAX_REQUESTS_PER_MINUTE = 100;
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  await app.register(fastifyRateLimit, {
    global: true,
    max: MAX_REQUESTS_PER_MINUTE,
    timeWindow: '1 minute',
    keyGenerator: (request) => request.ip,
    addHeaders: {
      'x-ratelimit-limit': true,
      'x-ratelimit-remaining': true,
      'x-ratelimit-reset': true,
      'retry-after': true
    },
    errorResponseBuilder: (request, context) => {
      const retryAfterSeconds = Number.isFinite(Number(context.after))
        ? Math.max(1, Math.ceil(Number(context.after)))
        : DEFAULT_RETRY_AFTER_SECONDS;

      return {
        statusCode: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: retryAfterSeconds
      };
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    if (reply.statusCode !== 429) {
      return payload;
    }

    const existingRetryAfter = reply.getHeader('retryAfter');
    if (existingRetryAfter) {
      return payload;
    }

    const retryAfterHeader = reply.getHeader('retry-after');
    if (typeof retryAfterHeader === 'string' || typeof retryAfterHeader === 'number') {
      reply.header('retryAfter', String(retryAfterHeader));
      return payload;
    }

    reply.header('retryAfter', String(DEFAULT_RETRY_AFTER_SECONDS));
    return payload;
  });
}
