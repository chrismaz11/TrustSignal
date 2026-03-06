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

function getJwtSecrets(): string[] {
  const rotatingSecrets = process.env.TRUSTSIGNAL_JWT_SECRETS
    ?.split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (rotatingSecrets && rotatingSecrets.length > 0) {
    return rotatingSecrets;
  }

  const legacySecret = process.env.TRUSTSIGNAL_JWT_SECRET?.trim();
  if (legacySecret) {
    return [legacySecret];
  }

  return [];
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

  const jwtSecrets = getJwtSecrets();
  if (jwtSecrets.length === 0) {
    reply.code(500).send({
      error: 'Configuration Error',
      message: 'TRUSTSIGNAL_JWT_SECRET or TRUSTSIGNAL_JWT_SECRETS must be configured'
    });
    done();
    return;
  }

  for (const secret of jwtSecrets) {
    try {
      const decoded = verify(token, secret);
      request.user = normalizeJwtPayload(decoded);
      done();
      return;
    } catch {
      // Continue to support key rotation: token may be signed with another configured key.
    }
  }

  unauthorized(reply, 'Invalid or expired token', done);
}
