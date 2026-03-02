import type { JwtPayload } from 'jsonwebtoken';
import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

import { authenticateJWT } from '../middleware/auth.js';
import { setRequestBundleHash } from '../middleware/logger.js';

import { createRouteDependencies, type RouteDependencies } from './dependencies.js';

const revokeBodySchema = z.object({
  bundle_hash: z.string().trim().min(1, 'bundle_hash is required'),
  reason: z.string().trim().min(3, 'reason is required')
});

function hasAdminClaim(payload: JwtPayload | undefined): boolean {
  if (!payload) {
    return false;
  }

  const role = payload.role;
  if (typeof role === 'string' && role.toLowerCase() === 'admin') {
    return true;
  }

  if (payload.admin === true || payload.is_admin === true) {
    return true;
  }

  const roles = payload.roles;
  if (Array.isArray(roles)) {
    return roles.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'admin');
  }

  return false;
}

interface RevokeRoutePluginOptions extends FastifyPluginOptions {
  deps?: Partial<RouteDependencies>;
}

export async function registerRevokeRoute(
  app: FastifyInstance,
  options: RevokeRoutePluginOptions = {}
): Promise<void> {
  const deps = createRouteDependencies(options.deps);

  app.post('/v1/revoke', { preHandler: authenticateJWT }, async (request, reply) => {
    const parsedBody = revokeBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parsedBody.error.flatten()
      });
    }

    if (!hasAdminClaim(request.user)) {
      return reply.code(403).send({
        error: 'Forbidden',
        message: 'Admin claim is required to revoke a bundle'
      });
    }

    const { bundle_hash: bundleHash, reason } = parsedBody.data;
    setRequestBundleHash(request, bundleHash);
    const existingRecord = await deps.recordStore.findByBundleHash(bundleHash);
    if (!existingRecord) {
      return reply.code(404).send({
        error: 'Not Found',
        message: 'Verification record not found'
      });
    }

    try {
      const anchor = await deps.anchorNullifier(bundleHash);
      const revokedAt = new Date(anchor.timestamp);
      if (Number.isNaN(revokedAt.valueOf())) {
        return reply.code(502).send({
          error: 'Upstream Error',
          message: 'Anchor service returned an invalid timestamp'
        });
      }

      const updatedRecord = await deps.recordStore.revokeByBundleHash(bundleHash, {
        reason,
        txHash: anchor.tx_hash,
        revokedAt
      });

      if (!updatedRecord) {
        return reply.code(404).send({
          error: 'Not Found',
          message: 'Verification record not found'
        });
      }

      return reply.send({
        revoked: true,
        tx_hash: anchor.tx_hash,
        timestamp: anchor.timestamp
      });
    } catch (error) {
      request.log.error(
        {
          err: error instanceof Error ? error.message : String(error)
        },
        'bundle revocation failed'
      );
      return reply.code(502).send({
        error: 'Upstream Error',
        message: 'Failed to anchor revocation on Polygon Mumbai'
      });
    }
  });
}
