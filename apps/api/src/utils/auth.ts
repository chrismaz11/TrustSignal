
import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';

export async function requireOrg(request: FastifyRequest, reply: FastifyReply, prisma: PrismaClient) {
  const apiKey = request.headers['x-api-key'] as string;
  
  if (!apiKey) {
    reply.code(401).send({ error: 'Unauthorized: Missing x-api-key' });
    return null;
  }

  const organization = await prisma.organization.findUnique({ where: { apiKey } });
  if (!organization) {
    reply.code(403).send({ error: 'Forbidden: Invalid API Key' });
    return null;
  }

  return organization;
}
