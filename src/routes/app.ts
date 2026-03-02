import Fastify, { type FastifyInstance } from 'fastify';

import { registerStructuredLogger } from '../middleware/logger.js';
import { registerRateLimit } from '../middleware/rateLimit.js';

import { createRouteDependencies, type RouteDependencies } from './dependencies.js';
import { registerRevokeRoute } from './revoke.js';
import { registerStatusRoute } from './status.js';
import { registerVerifyRoute } from './verify.js';

export interface BuildApiServerOptions {
  deps?: Partial<RouteDependencies>;
}

export async function buildApiServer(options: BuildApiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      redact: {
        paths: ['req.headers.authorization', 'authorization', 'headers.authorization'],
        censor: '[REDACTED]'
      }
    },
    disableRequestLogging: true
  });
  const deps = createRouteDependencies(options.deps);

  await registerStructuredLogger(app);
  await registerRateLimit(app);
  await registerVerifyRoute(app, { deps });
  await registerRevokeRoute(app, { deps });
  await registerStatusRoute(app, { deps });

  return app;
}
