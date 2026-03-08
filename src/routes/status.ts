import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

import { authenticateJWT } from '../middleware/auth.js';
import { setRequestBundleHash } from '../middleware/logger.js';
import type { CombinedResult } from '../types/VerificationResult.js';

import { createRouteDependencies, type RouteDependencies } from './dependencies.js';

const statusParamsSchema = z.object({
  bundleId: z.string().trim().min(1, 'bundleId is required')
});

interface StatusRoutePluginOptions extends FastifyPluginOptions {
  deps?: Partial<RouteDependencies>;
}

function toCombinedResult(record: {
  bundleHash: string;
  nonMemOk: boolean;
  revocationOk: boolean;
  zkmlOk: boolean;
  fraudScore: number;
  proofGenMs: number;
  timestamp: string;
}): CombinedResult {
  return {
    bundle_hash: record.bundleHash,
    non_mem_ok: record.nonMemOk,
    revocation_ok: record.revocationOk,
    zkml_ok: record.zkmlOk,
    fraud_score: record.fraudScore,
    proof_gen_ms: record.proofGenMs,
    timestamp: record.timestamp
  };
}

export async function registerStatusRoute(
  app: FastifyInstance,
  options: StatusRoutePluginOptions = {}
): Promise<void> {
  const deps = await createRouteDependencies(options.deps);

  app.get('/v1/status/:bundleId', { preHandler: authenticateJWT }, async (request, reply) => {
    const parsedParams = statusParamsSchema.safeParse(request.params);
    if (!parsedParams.success) {
      return reply.code(400).send({
        error: 'Invalid path parameter',
        details: parsedParams.error.flatten()
      });
    }

    const { bundleId } = parsedParams.data;
    setRequestBundleHash(request, bundleId);

    try {
      const record = await deps.recordStore.findByBundleHash(bundleId);
      if (!record) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Verification record not found'
        });
      }

      return reply.send(toCombinedResult(record));
    } catch (error) {
      request.log.error(
        {
          err: error instanceof Error ? error.message : String(error)
        },
        'status lookup failed'
      );
      return reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Unable to fetch verification status'
      });
    }
  });
}
