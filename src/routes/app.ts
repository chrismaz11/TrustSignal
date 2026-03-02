import Fastify, { type FastifyInstance } from 'fastify';

import { registerRateLimit } from '../middleware/rateLimit.js';
import { createRouteDependencies, type RouteDependencies } from './dependencies.js';
import { registerRevokeRoute } from './revoke.js';
import { registerStatusRoute } from './status.js';
import { registerVerifyRoute } from './verify.js';

export interface BuildApiServerOptions {
  deps?: Partial<RouteDependencies>;
}

export async function buildApiServer(options: BuildApiServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const deps = createRouteDependencies(options.deps);

  await registerRateLimit(app);
  await registerVerifyRoute(app, { deps });
  await registerRevokeRoute(app, { deps });
  await registerStatusRoute(app, { deps });

  return app;
}
