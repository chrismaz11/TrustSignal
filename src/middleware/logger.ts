import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    trustSignalStartedAtMs?: number;
    trustSignalBundleHash?: string;
  }
}

const BUNDLE_HASH_MAX_LENGTH = 128;

function normalizeBundleHash(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const sanitized = trimmed.replace(/[^a-zA-Z0-9:_-]/g, '');
  if (!sanitized) {
    return undefined;
  }

  return sanitized.slice(0, BUNDLE_HASH_MAX_LENGTH);
}

function resolveRoute(request: FastifyRequest): string {
  const routeOption = request.routeOptions?.url;
  if (typeof routeOption === 'string' && routeOption.length > 0) {
    return routeOption;
  }

  const url = request.url;
  const queryIndex = url.indexOf('?');
  if (queryIndex === -1) {
    return url;
  }
  return url.slice(0, queryIndex);
}

export function setRequestBundleHash(request: FastifyRequest, bundleHash: string): void {
  const normalized = normalizeBundleHash(bundleHash);
  if (!normalized) {
    return;
  }
  request.trustSignalBundleHash = normalized;
}

export async function registerStructuredLogger(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    request.trustSignalStartedAtMs = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startedAtMs = request.trustSignalStartedAtMs ?? Date.now();
    const durationMs = Math.max(0, Date.now() - startedAtMs);

    app.log.info(
      {
        request_id: request.id,
        route: resolveRoute(request),
        duration_ms: durationMs,
        status_code: reply.statusCode,
        bundle_hash: request.trustSignalBundleHash ?? null
      },
      'request_completed'
    );
  });
}
