import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyReply, FastifyRequest, HookHandlerDoneFunction } from 'fastify';
import { verify } from 'jsonwebtoken';

import { authenticateJWT } from '../../src/middleware/auth.js';

vi.mock('jsonwebtoken', async () => {
  const actual = await vi.importActual<typeof import('jsonwebtoken')>('jsonwebtoken');
  return {
    ...actual,
    verify: vi.fn()
  };
});

interface ReplyRecorder {
  reply: FastifyReply;
  code: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

function buildReply(): ReplyRecorder {
  const send = vi.fn();
  const code = vi.fn().mockImplementation(() => ({ send }));
  return {
    reply: { code } as unknown as FastifyReply,
    code,
    send
  };
}

function buildRequest(authorization?: string): FastifyRequest {
  return {
    headers: authorization ? { authorization } : {},
    user: undefined
  } as unknown as FastifyRequest;
}

describe('authenticateJWT middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.TRUSTSIGNAL_JWT_SECRET = 'unit-test-secret';
    delete process.env.TRUSTSIGNAL_JWT_SECRETS;
  });

  it('rejects when authorization header is missing', () => {
    const request = buildRequest();
    const { reply, code, send } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(code).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing Authorization header'
    });
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects invalid authorization scheme', () => {
    const request = buildRequest('Basic token');
    const { reply, code, send } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(code).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid Authorization header format. Expected Bearer token.'
    });
    expect(done).toHaveBeenCalledOnce();
  });

  it('returns 500 when JWT secret is missing', () => {
    delete process.env.TRUSTSIGNAL_JWT_SECRET;
    delete process.env.TRUSTSIGNAL_JWT_SECRETS;

    const request = buildRequest('Bearer valid-token');
    const { reply, code, send } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(code).toHaveBeenCalledWith(500);
    expect(send).toHaveBeenCalledWith({
      error: 'Configuration Error',
      message: 'TRUSTSIGNAL_JWT_SECRET or TRUSTSIGNAL_JWT_SECRETS must be configured'
    });
    expect(done).toHaveBeenCalledOnce();
  });

  it('supports JWT key rotation via TRUSTSIGNAL_JWT_SECRETS', () => {
    delete process.env.TRUSTSIGNAL_JWT_SECRET;
    process.env.TRUSTSIGNAL_JWT_SECRETS = 'old-secret,new-secret';

    vi.mocked(verify)
      .mockImplementationOnce(() => {
        throw new Error('invalid signature');
      })
      .mockReturnValueOnce({ sub: 'rotated-user' });

    const request = buildRequest('Bearer rotated-token');
    const { reply } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(verify).toHaveBeenCalledTimes(2);
    expect(request.user).toEqual({ sub: 'rotated-user' });
    expect(done).toHaveBeenCalledOnce();
  });

  it('normalizes string payload from verify()', () => {
    vi.mocked(verify).mockReturnValueOnce('service-user');

    const request = buildRequest('Bearer valid-token');
    const { reply } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(request.user).toEqual({ sub: 'service-user' });
    expect(done).toHaveBeenCalledOnce();
  });

  it('rejects invalid tokens', () => {
    vi.mocked(verify).mockImplementationOnce(() => {
      throw new Error('invalid signature');
    });

    const request = buildRequest('Bearer invalid-token');
    const { reply, code, send } = buildReply();
    const done = vi.fn() as HookHandlerDoneFunction;

    authenticateJWT(request, reply, done);

    expect(code).toHaveBeenCalledWith(401);
    expect(send).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
    expect(done).toHaveBeenCalledOnce();
  });
});
