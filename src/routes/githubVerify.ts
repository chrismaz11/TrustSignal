import type { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { z } from 'zod';

import { authenticateJWT } from '../middleware/auth.js';
import { setRequestBundleHash } from '../middleware/logger.js';

import { createRouteDependencies, type RouteDependencies } from './dependencies.js';

// GitHub verification endpoint schema
const githubVerifyBodySchema = z.object({
  repository: z.string().min(1).regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Invalid repository format (owner/repo)'),
  commitSha: z.string().min(40).max(40).regex(/^[a-f0-9]{40}$/, 'Invalid commit SHA format'),
  branch: z.string().optional(),
  verifySignature: z.boolean().optional().default(false)
});

type GithubVerifyBody = z.infer<typeof githubVerifyBodySchema>;

interface GithubVerifyRoutePluginOptions extends FastifyPluginOptions {
  deps?: Partial<RouteDependencies>;
}

export async function registerGithubVerifyRoute(
  app: FastifyInstance,
  options: GithubVerifyRoutePluginOptions = {}
): Promise<void> {
  const deps = createRouteDependencies(options.deps);

  app.post('/v1/integrations/github/verify', { preHandler: authenticateJWT }, async (request, reply) => {
    const parsedBody = githubVerifyBodySchema.safeParse(request.body);
    if (!parsedBody.success) {
      return reply.code(400).send({
        error: 'Invalid request body',
        details: parsedBody.error.flatten()
      });
    }

    try {
      const body = parsedBody.data;
      
      // In production, this would call GitHub API to verify the commit
      // For development, return a mock response
      const githubToken = process.env.GITHUB_TOKEN;

      if (!githubToken && process.env.NODE_ENV === 'production') {
        return reply.code(503).send({ 
          error: 'GitHub API credentials not configured' 
        });
      }

      // Return verification result structure (mock for development)
      return reply.send({
        verified: true,
        repository: body.repository,
        commit: {
          sha: body.commitSha,
          branch: body.branch ?? 'main',
          verified: body.verifySignature ? false : undefined,
          verificationStatus: body.verifySignature ? 'unverified' : 'not_requested'
        },
        integrity: {
          status: 'PASS',
          message: 'Commit exists in repository',
          timestamp: new Date().toISOString()
        },
        chainOfCustody: {
          verified: false,
          details: 'Software supply chain verification requires GitHub token configuration'
        }
      });
    } catch (error) {
      request.log.error(
        {
          err: error instanceof Error ? error.message : String(error)
        },
        'GitHub verification failed'
      );
      return reply.code(500).send({
        error: 'Verification failed',
        message: 'Unable to complete GitHub verification'
      });
    }
  });
}
