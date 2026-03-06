import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { registerStructuredLogger, setRequestBundleHash } from '../../src/middleware/logger.js';

function parseJsonLogs(lines: readonly string[]): Record<string, unknown>[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

function findRequestCompleted(entries: readonly Record<string, unknown>[]): Record<string, unknown> {
  const found = entries.find((entry) => entry.msg === 'request_completed');
  if (!found) {
    throw new Error('expected request_completed log entry');
  }
  return found;
}

describe('structured logger middleware', () => {
  let app: FastifyInstance;
  let logLines: string[];

  beforeEach(async () => {
    logLines = [];
    app = Fastify({
      logger: {
        level: 'info',
        stream: {
          write: (line: string) => {
            logLines.push(line);
          }
        }
      },
      disableRequestLogging: true
    });

    await registerStructuredLogger(app);

    app.get('/bundle/:bundleId', async (request) => {
      const params = request.params as { bundleId: string };
      setRequestBundleHash(request, params.bundleId);
      return { ok: true };
    });

    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('logs request metadata including route, status and bundle hash', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/bundle/abC_123-xyz'
    });

    expect(response.statusCode).toBe(200);

    const entry = findRequestCompleted(parseJsonLogs(logLines));
    expect(entry.request_id).toBeTypeOf('string');
    expect(entry.route).toBe('/bundle/:bundleId');
    expect(entry.status_code).toBe(200);
    expect(entry.bundle_hash).toBe('abC_123-xyz');
    expect(entry.duration_ms).toBeTypeOf('number');
  });

  it('sanitizes and truncates bundle hash values', async () => {
    const request = {} as FastifyRequest;
    const longHash = `   ${'A'.repeat(150)}***%%%   `;

    setRequestBundleHash(request, longHash);

    expect(request.trustSignalBundleHash).toBe('A'.repeat(128));
  });

  it('ignores empty/invalid bundle hash values', async () => {
    const request = {} as FastifyRequest;

    setRequestBundleHash(request, '   !!!   ');
    setRequestBundleHash(request, '      ');

    expect(request.trustSignalBundleHash).toBeUndefined();
  });

  it('falls back to URL path for unmatched routes and strips query strings', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/unknown-path?token=secret'
    });

    expect(response.statusCode).toBe(404);

    const entry = findRequestCompleted(parseJsonLogs(logLines));
    expect(entry.route).toBe('/unknown-path');
    expect(entry.bundle_hash).toBeNull();
  });

  it('falls back to raw URL path when query string is absent', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/missing-no-query'
    });

    expect(response.statusCode).toBe(404);

    const entry = findRequestCompleted(parseJsonLogs(logLines));
    expect(entry.route).toBe('/missing-no-query');
  });
});
