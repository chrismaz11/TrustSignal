import { createHash } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';

import { PrismaClient } from '@prisma/client';

type ReplayReservationInput = {
  clientId: string;
  jti: string;
  expiresAt: Date;
};

export interface AssertionReplayStore {
  reserve(input: ReplayReservationInput): Promise<boolean>;
}

function hashAssertionJti(clientId: string, jti: string): string {
  return createHash('sha256').update(`${clientId}:${jti}`).digest('hex');
}

export class PrismaAssertionReplayStore implements AssertionReplayStore {
  constructor(private readonly prisma: PrismaClient) {}

  async reserve(input: ReplayReservationInput): Promise<boolean> {
    await this.prisma.clientAssertionNonce.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });

    try {
      await this.prisma.clientAssertionNonce.create({
        data: {
          clientId: input.clientId,
          jtiHash: hashAssertionJti(input.clientId, input.jti),
          expiresAt: input.expiresAt
        }
      });
      return true;
    } catch {
      return false;
    }
  }
}

type RedisConnectionConfig = {
  host: string;
  port: number;
  username?: string;
  password?: string;
  database?: number;
  tls: boolean;
};

export class RedisAssertionReplayStore implements AssertionReplayStore {
  constructor(private readonly redisUrl: string) {}

  async reserve(input: ReplayReservationInput): Promise<boolean> {
    const key = `trustsignal:assertion-jti:${input.clientId}:${hashAssertionJti(input.clientId, input.jti)}`;
    const ttlSeconds = Math.max(1, Math.ceil((input.expiresAt.getTime() - Date.now()) / 1000));
    const connection = parseRedisUrl(this.redisUrl);
    const socket = await connectRedis(connection);

    try {
      if (connection.password) {
        if (connection.username) {
          await sendRedisCommand(socket, ['AUTH', connection.username, connection.password]);
        } else {
          await sendRedisCommand(socket, ['AUTH', connection.password]);
        }
      }

      if (typeof connection.database === 'number' && Number.isFinite(connection.database)) {
        await sendRedisCommand(socket, ['SELECT', String(connection.database)]);
      }

      const reply = await sendRedisCommand(socket, ['SET', key, '1', 'EX', String(ttlSeconds), 'NX']);
      return reply === 'OK';
    } finally {
      socket.end();
      socket.destroy();
    }
  }
}

export function buildAssertionReplayStore(prisma: PrismaClient, env: NodeJS.ProcessEnv = process.env): AssertionReplayStore {
  const redisUrl = (env.TRUSTSIGNAL_REPLAY_REDIS_URL || '').trim();
  if (redisUrl) {
    return new RedisAssertionReplayStore(redisUrl);
  }

  return new PrismaAssertionReplayStore(prisma);
}

function parseRedisUrl(redisUrl: string): RedisConnectionConfig {
  const parsed = new URL(redisUrl);
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('TRUSTSIGNAL_REPLAY_REDIS_URL must use redis:// or rediss://');
  }

  const database = parsed.pathname && parsed.pathname !== '/' ? Number.parseInt(parsed.pathname.slice(1), 10) : undefined;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number.parseInt(parsed.port, 10) : parsed.protocol === 'rediss:' ? 6380 : 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    database: Number.isFinite(database) ? database : undefined,
    tls: parsed.protocol === 'rediss:'
  };
}

function connectRedis(config: RedisConnectionConfig): Promise<net.Socket | tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const socket = config.tls
      ? tls.connect({
          host: config.host,
          port: config.port
        })
      : net.createConnection({
          host: config.host,
          port: config.port
        });

    const onError = (error: Error) => {
      cleanup();
      socket.destroy();
      reject(error);
    };

    const onReady = () => {
      cleanup();
      resolve(socket);
    };

    const cleanup = () => {
      socket.removeListener('error', onError);
      socket.removeListener(config.tls ? 'secureConnect' : 'connect', onReady);
    };

    socket.once('error', onError);
    socket.once(config.tls ? 'secureConnect' : 'connect', onReady);
  });
}

function sendRedisCommand(socket: net.Socket | tls.TLSSocket, parts: string[]): Promise<string | null> {
  return new Promise((resolve, reject) => {
    let buffer = '';

    const cleanup = () => {
      socket.off('data', onData);
      socket.off('error', onError);
      socket.off('close', onClose);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const onClose = () => {
      cleanup();
      reject(new Error('Redis connection closed before reply'));
    };

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const parsed = tryParseResp(buffer);
      if (!parsed.complete) {
        return;
      }

      cleanup();
      if (parsed.error) {
        reject(new Error(parsed.error));
        return;
      }
      resolve(parsed.value);
    };

    socket.on('data', onData);
    socket.once('error', onError);
    socket.once('close', onClose);
    socket.write(encodeResp(parts));
  });
}

function encodeResp(parts: string[]): string {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part)}\r\n${part}\r\n`).join('')}`;
}

function tryParseResp(payload: string): { complete: boolean; value: string | null; error?: string } {
  if (!payload.includes('\r\n')) {
    return { complete: false, value: null };
  }

  const prefix = payload[0];
  const lineEnd = payload.indexOf('\r\n');
  const line = payload.slice(1, lineEnd);

  if (prefix === '+') {
    return { complete: true, value: line };
  }

  if (prefix === '-') {
    return { complete: true, value: null, error: line };
  }

  if (prefix === ':') {
    return { complete: true, value: line };
  }

  if (prefix === '$') {
    const length = Number.parseInt(line, 10);
    if (length === -1) {
      return { complete: true, value: null };
    }

    const expectedEnd = lineEnd + 2 + length + 2;
    if (payload.length < expectedEnd) {
      return { complete: false, value: null };
    }

    const value = payload.slice(lineEnd + 2, lineEnd + 2 + length);
    return { complete: true, value };
  }

  return { complete: false, value: null };
}
