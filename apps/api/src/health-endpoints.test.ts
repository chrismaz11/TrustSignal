import { afterEach, describe, expect, it, vi } from 'vitest';

async function buildServerWithDatabaseFailure(message: string, logLines: string[]) {
  vi.resetModules();
  vi.doMock('./db.js', () => ({
    ensureDatabase: vi.fn().mockRejectedValue(new Error(message))
  }));

  const { buildServer } = await import('./server.js');
  return buildServer({
    logger: {
      level: 'info',
      stream: {
        write: (line: string) => {
          logLines.push(line);
        }
      }
    }
  });
}

afterEach(() => {
  vi.resetModules();
  vi.doUnmock('./db.js');
});

describe('health and status endpoints', () => {
  it('redacts raw database init errors from public responses and logs', async () => {
    const logLines: string[] = [];
    const app = await buildServerWithDatabaseFailure(
      'postgresql://db_user:super-secret-password@db.internal.example/trustsignal?sslmode=disable',
      logLines
    );

    try {
      const health = await app.inject({
        method: 'GET',
        url: '/api/v1/health'
      });
      const status = await app.inject({
        method: 'GET',
        url: '/api/v1/status'
      });

      expect(health.statusCode).toBe(200);
      expect(status.statusCode).toBe(200);

      expect(health.json()).toEqual({
        status: 'degraded',
        database: {
          ready: false,
          initError: 'database_initialization_failed'
        }
      });

      const statusBody = status.json() as {
        database?: { ready?: boolean; initError?: string | null };
      };

      expect(statusBody.database?.ready).toBe(false);
      expect(statusBody.database?.initError).toBe('database_initialization_failed');

      const serialized = JSON.stringify({ health: health.json(), status: statusBody });
      const serializedLogs = logLines.join('\n');
      expect(serialized).not.toContain('super-secret-password');
      expect(serialized).not.toContain('db.internal.example');
      expect(serialized).not.toContain('postgresql://');
      expect(serializedLogs).not.toContain('super-secret-password');
      expect(serializedLogs).not.toContain('db.internal.example');
      expect(serializedLogs).not.toContain('postgresql://');
    } finally {
      await app.close();
    }
  });
});
