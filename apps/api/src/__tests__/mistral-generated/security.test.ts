import { describe, it, expect, vi } from 'vitest';
import {
  buildSecurityConfig,
  buildReceiptSigningConfig,
  requireApiKeyScope,
  getApiRateLimitKey,
  isCorsOriginAllowed,
  verifyRevocationHeaders,
  checkPlanQuota,
  getMonthlyUsageStats,
  PLAN_MONTHLY_LIMITS
} from '../../security.js';
import { PrismaClient } from '@prisma/client';
import { FastifyReply, FastifyRequest } from 'fastify';

vi.mock('@prisma/client');

describe('security', () => {
  describe('buildReceiptSigningConfig', () => {
    it('should return dev-only config in development without env vars', () => {
      const env = { NODE_ENV: 'development' };
      const config = buildReceiptSigningConfig(env);
      expect(config.mode).toBe('dev-only');
      expect(config.current.kid).toBe('dev-local-receipt-signer-v1');
    });

    it('should throw in production without required env vars', () => {
      const env = { NODE_ENV: 'production' };
      expect(() => buildReceiptSigningConfig(env)).toThrow('Missing required production receipt-signing env vars');
    });

    it('should use configured keys in production', () => {
      const env = {
        NODE_ENV: 'production',
        TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', d: 'test', x: 'test' }),
        TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', x: 'test' }),
        TRUSTSIGNAL_RECEIPT_SIGNING_KID: 'test-kid'
      };
      const config = buildReceiptSigningConfig(env);
      expect(config.mode).toBe('configured');
      expect(config.current.kid).toBe('test-kid');
    });
  });

  describe('buildSecurityConfig', () => {
    it('should build config with default values', () => {
      const env = { NODE_ENV: 'development' };
      const config = buildSecurityConfig(env);
      expect(config.globalRateLimitMax).toBe(600);
      expect(config.perApiKeyRateLimitMax).toBe(120);
      expect(config.rateLimitWindow).toBe('1 minute');
    });

    it('should parse custom rate limits', () => {
      const env = {
        NODE_ENV: 'development',
        RATE_LIMIT_GLOBAL_MAX: '1000',
        RATE_LIMIT_API_KEY_MAX: '200',
        RATE_LIMIT_WINDOW: '5 minutes'
      };
      const config = buildSecurityConfig(env);
      expect(config.globalRateLimitMax).toBe(1000);
      expect(config.perApiKeyRateLimitMax).toBe(200);
      expect(config.rateLimitWindow).toBe('5 minutes');
    });

    it('should parse revocation issuers', () => {
      const env = {
        NODE_ENV: 'development',
        REVOCATION_ISSUERS: 'issuer1=0x1234567890123456789012345678901234567890'
      };
      const config = buildSecurityConfig(env);
      expect(config.revocationIssuers.get('issuer1')).toBe('0x1234567890123456789012345678901234567890');
    });

    it('should build CORS allowlist', () => {
      const env = {
        NODE_ENV: 'development',
        CORS_ALLOWLIST: 'https://example.com,https://test.com'
      };
      const config = buildSecurityConfig(env);
      expect(config.corsAllowlist).toEqual(new Set(['https://example.com', 'https://test.com']));
    });
  });

  describe('requireApiKeyScope', () => {
    const mockPrisma = {} as PrismaClient;
    const mockConfig = {
      localDevApiKeys: new Map([['test-key', new Set(['verify', 'read'])]]),
      revocationIssuers: new Map(),
      revocationMaxSkewMs: 300000,
      globalRateLimitMax: 600,
      perApiKeyRateLimitMax: 120,
      rateLimitWindow: '1 minute',
      corsAllowlist: new Set(),
      receiptSigning: {
        mode: 'dev-only',
        current: {
          privateJwk: { kty: 'OKP', crv: 'Ed25519', d: 'test', x: 'test' },
          publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test' },
          kid: 'test-kid',
          alg: 'EdDSA'
        },
        verificationKeys: new Map()
      }
    };

    it('should reject missing API key', async () => {
      const mockRequest = { headers: {} } as FastifyRequest;
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn()
      } as unknown as FastifyReply;

      const authenticate = requireApiKeyScope(mockPrisma, mockConfig, 'verify');
      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Unauthorized: missing bearer token or x-api-key' });
    });

    it('should accept local dev API key with correct scope', async () => {
      const mockRequest = { headers: { 'x-api-key': 'test-key' } } as FastifyRequest;
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn()
      } as unknown as FastifyReply;

      const authenticate = requireApiKeyScope(mockPrisma, mockConfig, 'verify');
      await authenticate(mockRequest, mockReply);

      expect(mockRequest.authContext).toBeDefined();
      expect(mockRequest.authContext?.authSource).toBe('local-dev');
    });

    it('should reject local dev API key without required scope', async () => {
      const mockRequest = { headers: { 'x-api-key': 'test-key' } } as FastifyRequest;
      const mockReply = {
        code: vi.fn().mockReturnThis(),
        send: vi.fn()
      } as unknown as FastifyReply;

      const authenticate = requireApiKeyScope(mockPrisma, mockConfig, 'anchor');
      await authenticate(mockRequest, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({ error: 'Forbidden: missing scope anchor' });
    });
  });

  describe('getApiRateLimitKey', () => {
    it('should return fingerprint for API key', () => {
      const mockRequest = { headers: { 'x-api-key': 'test-key' }, ip: '127.0.0.1' } as FastifyRequest;
      const key = getApiRateLimitKey(mockRequest);
      expect(key).toBe('5f1d799b0f3f');
    });

    it('should return IP for missing API key', () => {
      const mockRequest = { headers: {}, ip: '127.0.0.1' } as FastifyRequest;
      const key = getApiRateLimitKey(mockRequest);
      expect(key).toBe('127.0.0.1');
    });
  });

  describe('isCorsOriginAllowed', () => {
    const config = {
      localDevApiKeys: new Map(),
      revocationIssuers: new Map(),
      revocationMaxSkewMs: 300000,
      globalRateLimitMax: 600,
      perApiKeyRateLimitMax: 120,
      rateLimitWindow: '1 minute',
      corsAllowlist: new Set(['https://example.com']),
      receiptSigning: {
        mode: 'dev-only',
        current: {
          privateJwk: { kty: 'OKP', crv: 'Ed25519', d: 'test', x: 'test' },
          publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test' },
          kid: 'test-kid',
          alg: 'EdDSA'
        },
        verificationKeys: new Map()
      }
    };

    it('should allow origin in allowlist', () => {
      expect(isCorsOriginAllowed(config, 'https://example.com')).toBe(true);
    });

    it('should reject origin not in allowlist', () => {
      expect(isCorsOriginAllowed(config, 'https://unknown.com')).toBe(false);
    });

    it('should allow undefined origin', () => {
      expect(isCorsOriginAllowed(config, undefined)).toBe(true);
    });

    it('should reject all origins if allowlist is empty', () => {
      const emptyConfig = { ...config, corsAllowlist: new Set() };
      expect(isCorsOriginAllowed(emptyConfig, 'https://example.com')).toBe(false);
    });
  });

  describe('verifyRevocationHeaders', () => {
    const config = {
      localDevApiKeys: new Map(),
      revocationIssuers: new Map([['issuer1', '0x1234567890123456789012345678901234567890']]),
      revocationMaxSkewMs: 300000,
      globalRateLimitMax: 600,
      perApiKeyRateLimitMax: 120,
      rateLimitWindow: '1 minute',
      corsAllowlist: new Set(),
      receiptSigning: {
        mode: 'dev-only',
        current: {
          privateJwk: { kty: 'OKP', crv: 'Ed25519', d: 'test', x: 'test' },
          publicJwk: { kty: 'OKP', crv: 'Ed25519', x: 'test' },
          kid: 'test-kid',
          alg: 'EdDSA'
        },
        verificationKeys: new Map()
      }
    };

    it('should reject missing headers', () => {
      const mockRequest = { headers: {} } as FastifyRequest;
      const result = verifyRevocationHeaders(mockRequest, 'receipt1', config);
      expect(result).toEqual({ ok: false, error: 'missing_revocation_signature_headers' });
    });

    it('should reject unknown issuer', () => {
      const mockRequest = {
        headers: {
          'x-issuer-id': 'unknown',
          'x-issuer-signature': 'sig',
          'x-signature-timestamp': '1234567890'
        }
      } as FastifyRequest;
      const result = verifyRevocationHeaders(mockRequest, 'receipt1', config);
      expect(result).toEqual({ ok: false, error: 'issuer_not_allowed' });
    });

    it('should reject stale timestamp', () => {
      const oldTimestamp = new Date(Date.now() - 400000).getTime().toString();
      const mockRequest = {
        headers: {
          'x-issuer-id': 'issuer1',
          'x-issuer-signature': 'sig',
          'x-signature-timestamp': oldTimestamp
        }
      } as FastifyRequest;
      const result = verifyRevocationHeaders(mockRequest, 'receipt1', config);
      expect(result).toEqual({ ok: false, error: 'stale_signature_timestamp' });
    });
  });

  describe('checkPlanQuota', () => {
    const mockPrisma = {
      $queryRaw: vi.fn()
    } as unknown as PrismaClient;

    it('should allow local dev keys (no userId)', async () => {
      const result = await checkPlanQuota(mockPrisma, null);
      expect(result).toEqual({ allowed: true });
    });

    it('should allow within quota', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([
        { plan: 'free', used: 500n }
      ]);
      const result = await checkPlanQuota(mockPrisma, 'user1');
      expect(result).toEqual({ allowed: true });
    });

    it('should reject over quota', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([
        { plan: 'free', used: 1500n }
      ]);
      const result = await checkPlanQuota(mockPrisma, 'user1');
      expect(result).toEqual({ allowed: false, plan: 'free', used: 1500, limit: 1000 });
    });

    it('should allow enterprise (unlimited)', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([
        { plan: 'enterprise', used: 1000000n }
      ]);
      const result = await checkPlanQuota(mockPrisma, 'user1');
      expect(result).toEqual({ allowed: true });
    });

    it('should allow if database error occurs', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockRejectedValue(new Error('table not found'));
      const result = await checkPlanQuota(mockPrisma, 'user1');
      expect(result).toEqual({ allowed: true });
    });
  });

  describe('getMonthlyUsageStats', () => {
    const mockPrisma = {
      $queryRaw: vi.fn()
    } as unknown as PrismaClient;

    it('should return usage stats for free plan', async () => {
      const now = new Date();
      const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([
        { plan: 'free', used: 500n }
      ]);

      const result = await getMonthlyUsageStats(mockPrisma, 'user1');
      expect(result).toEqual({
        plan: 'free',
        used: 500,
        limit: 1000,
        remaining: 500,
        resetAt
      });
    });

    it('should return usage stats for enterprise plan', async () => {
      const now = new Date();
      const resetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();
      vi.mocked(mockPrisma.$queryRaw).mockResolvedValue([
        { plan: 'enterprise', used: 1000000n }
      ]);

      const result = await getMonthlyUsageStats(mockPrisma, 'user1');
      expect(result).toEqual({
        plan: 'enterprise',
        used: 1000000,
        limit: null,
        remaining: null,
        resetAt
      });
    });

    it('should return null if database error occurs', async () => {
      vi.mocked(mockPrisma.$queryRaw).mockRejectedValue(new Error('table not found'));
      const result = await getMonthlyUsageStats(mockPrisma, 'user1');
      expect(result).toBeNull();
    });
  });

  describe('PLAN_MONTHLY_LIMITS', () => {
    it('should have correct limits', () => {
      expect(PLAN_MONTHLY_LIMITS.free).toBe(1000);
      expect(PLAN_MONTHLY_LIMITS.pro).toBe(100000);
      expect(PLAN_MONTHLY_LIMITS.enterprise).toBe(Infinity);
    });
  });
});
