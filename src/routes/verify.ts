import '@fastify/rate-limit';

import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

import { authenticateJWT } from '../middleware/auth.js';
import { setRequestBundleHash } from '../middleware/logger.js';

import { createRouteDependencies, type RouteDependencies } from './dependencies.js';

const verifyBundleBodySchema = z.object({
  deed_hash: z.string().trim().min(1, 'deed_hash is required'),
  text_length: z.number().int().nonnegative(),
  num_signatures: z.number().int().nonnegative(),
  notary_present: z.boolean(),
  days_since_notarized: z.number().int().nonnegative(),
  amount: z.number().nonnegative()
});

type VerifyBundleBody = z.infer<typeof verifyBundleBodySchema>;

function hashSignal(deedHash: string): number {
  const normalized = deedHash.replace(/[^a-fA-F0-9]/g, '').slice(0, 8);
  if (!normalized) {
    return 0;
  }
  const parsed = Number.parseInt(normalized, 16);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed / 0xffffffff;
}

function toFeatureVector(body: VerifyBundleBody): readonly number[] {
  return [
    body.text_length / 10_000,
    body.num_signatures,
    body.notary_present ? 1 : 0,
    body.days_since_notarized / 365,
    body.amount / 1_000_000,
    hashSignal(body.deed_hash)
  ];
}

interface VerifyRoutePluginOptions extends FastifyPluginOptions {
  deps?: Partial<RouteDependencies>;
}

export async function registerVerifyRoute(
  app: FastifyInstance,
  options: VerifyRoutePluginOptions = {}
): Promise<void> {
  const deps = createRouteDependencies(options.deps);

  app.post('/v1/verify-bundle', {
    preHandler: [authenticateJWT],
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute'
      }
    }
  }, async (request, reply) => {
    const parsedBody = verifyBundleBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parsedBody.error.flatten()
      });
    }

    try {
      const body = parsedBody.data;
      setRequestBundleHash(request, body.deed_hash);
      const combinedResult = await deps.verifyBundle({
        bundle_hash: body.deed_hash,
        deed_features: toFeatureVector(body)
      });

      const record = await deps.recordStore.create({
        bundleHash: combinedResult.bundle_hash,
        nonMemOk: combinedResult.non_mem_ok,
        revocationOk: combinedResult.revocation_ok,
        zkmlOk: combinedResult.zkml_ok,
        fraudScore: combinedResult.fraud_score,
        proofGenMs: combinedResult.proof_gen_ms,
        timestamp: combinedResult.timestamp
      });

      return reply.send({
        ...combinedResult,
        record_id: record.id
      });
    } catch (error) {
      request.log.error(
        {
          err: error instanceof Error ? error.message : String(error)
        },
        'bundle verification failed'
      );
      return reply.code(500).send({
        error: 'Verification failed',
        message: 'Unable to complete bundle verification'
      });
    }
  });
}
