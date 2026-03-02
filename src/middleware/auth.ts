import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { verify, type JwtPayload } from 'jsonwebtoken';

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}

function unauthorized(reply: FastifyReply, message: string, done: HookHandlerDoneFunction): void {
  reply.code(401).send({
    error: 'Unauthorized',
    message
  });
  done();
}

function normalizeJwtPayload(decoded: string | JwtPayload): JwtPayload {
  if (typeof decoded === 'string') {
    return { sub: decoded };
  }
  return decoded;
}

export function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction
): void {
  const authorization = request.headers.authorization;
  if (!authorization) {
    unauthorized(reply, 'Missing Authorization header', done);
    return;
  }

  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    unauthorized(reply, 'Invalid Authorization header format. Expected Bearer token.', done);
    return;
  }

  const jwtSecret = process.env.TRUSTSIGNAL_JWT_SECRET;
  if (!jwtSecret) {
    reply.code(500).send({
      error: 'Configuration Error',
      message: 'TRUSTSIGNAL_JWT_SECRET is not configured'
    });
    done();
    return;
  }

  try {
    const decoded = verify(token, jwtSecret);
    request.user = normalizeJwtPayload(decoded);
    done();
  } catch {
    unauthorized(reply, 'Invalid or expired token', done);
  }
}
