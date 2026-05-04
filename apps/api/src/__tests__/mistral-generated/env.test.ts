import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadRuntimeEnv, validateRequiredEnv, resolveDatabaseUrl, parseEnvFile } from '../../env.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('node:fs');
vi.mock('node:path');

describe('env', () => {
  describe('parseEnvFile', () => {
    it('should parse valid env file', () => {
      const content = `
KEY1=value1
KEY2="value2"
KEY3='value3'
# Comment
KEY4=value4
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({
        KEY1: 'value1',
        KEY2: 'value2',
        KEY3: 'value3',
        KEY4: 'value4'
      });
    });

    it('should ignore comments and empty lines', () => {
      const content = `
# Comment

KEY1=value1
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({ KEY1: 'value1' });
    });

    it('should ignore invalid lines', () => {
      const content = `
KEY1=value1
invalid-line
KEY2=value2
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({ KEY1: 'value1', KEY2: 'value2' });
    });

    it('should handle quoted values', () => {
      const content = `
KEY1="quoted value"
KEY2='single quoted'
`;
      const result = parseEnvFile(content);
      expect(result).toEqual({
        KEY1: 'quoted value',
        KEY2: 'single quoted'
      });
    });
  });

  describe('loadRuntimeEnv', () => {
    beforeEach(() => {
      vi.resetModules();
      vi.resetAllMocks();
      delete process.env.TEST_KEY;
    });

    it('should load env from .env file', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('TEST_KEY=test-value');
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));

      loadRuntimeEnv();
      expect(process.env.TEST_KEY).toBe('test-value');
    });

    it('should not override existing env vars', () => {
      process.env.TEST_KEY = 'existing-value';
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('TEST_KEY=new-value');
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));

      loadRuntimeEnv();
      expect(process.env.TEST_KEY).toBe('existing-value');
    });

    it('should load from multiple env files', () => {
      let callCount = 0;
      vi.mocked(existsSync).mockImplementation(() => {
        callCount++;
        return callCount <= 2;
      });
      vi.mocked(readFileSync).mockImplementation((file) => {
        if (file.includes('.env')) return 'KEY1=value1';
        if (file.includes('../../.env')) return 'KEY2=value2';
        return '';
      });
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));

      loadRuntimeEnv();
      expect(process.env.KEY1).toBe('value1');
      expect(process.env.KEY2).toBe('value2');
    });

    it('should only load once', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('TEST_KEY=value1');
      vi.mocked(path.resolve).mockImplementation((...args) => args.join('/'));

      loadRuntimeEnv();
      const firstValue = process.env.TEST_KEY;

      vi.mocked(readFileSync).mockReturnValue('TEST_KEY=value2');
      loadRuntimeEnv();

      expect(process.env.TEST_KEY).toBe(firstValue);
    });
  });

  describe('validateRequiredEnv', () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      delete process.env.SUPABASE_DB_URL;
      delete process.env.SUPABASE_POOLER_URL;
      delete process.env.SUPABASE_DIRECT_URL;
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK;
      delete process.env.TRUSTSIGNAL_SIGNING_PRIVATE_JWK;
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_KID;
      delete process.env.TRUSTSIGNAL_SIGNING_KEY_ID;
      delete process.env.NODE_ENV;
    });

    it('should throw if DATABASE_URL is missing', () => {
      expect(() => validateRequiredEnv()).toThrow('Missing required environment variables: DATABASE_URL');
    });

    it('should accept DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('should accept SUPABASE_DB_URL', () => {
      process.env.SUPABASE_DB_URL = 'postgres://user:pass@localhost:5432/db';
      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('should throw in production without signing keys', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

      expect(() => validateRequiredEnv()).toThrow('Missing required environment variables: TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK, TRUSTSIGNAL_RECEIPT_SIGNING_KID');
    });

    it('should accept signing keys in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK = '{"kty":"OKP","crv":"Ed25519","d":"test","x":"test"}';
      process.env.TRUSTSIGNAL_RECEIPT_SIGNING_KID = 'test-kid';

      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('should accept legacy signing key names', () => {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      process.env.TRUSTSIGNAL_SIGNING_PRIVATE_JWK = '{"kty":"OKP","crv":"Ed25519","d":"test","x":"test"}';
      process.env.TRUSTSIGNAL_SIGNING_KEY_ID = 'test-kid';

      expect(() => validateRequiredEnv()).not.toThrow();
    });

    it('should not require signing keys in development', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';

      expect(() => validateRequiredEnv()).not.toThrow();
    });
  });

  describe('resolveDatabaseUrl', () => {
    beforeEach(() => {
      delete process.env.DATABASE_URL;
      delete process.env.SUPABASE_DB_URL;
      delete process.env.SUPABASE_POOLER_URL;
      delete process.env.SUPABASE_DIRECT_URL;
    });

    it('should return DATABASE_URL if set', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
      const result = resolveDatabaseUrl();
      expect(result).toBe('postgres://user:pass@localhost:5432/db');
    });

    it('should return SUPABASE_DB_URL if DATABASE_URL not set', () => {
      process.env.SUPABASE_DB_URL = 'postgres://user:pass@localhost:5432/db';
      const result = resolveDatabaseUrl();
      expect(result).toBe('postgres://user:pass@localhost:5432/db');
    });

    it('should return SUPABASE_POOLER_URL if others not set', () => {
      process.env.SUPABASE_POOLER_URL = 'postgres://user:pass@localhost:5432/db';
      const result = resolveDatabaseUrl();
      expect(result).toBe('postgres://user:pass@localhost:5432/db');
    });

    it('should return SUPABASE_DIRECT_URL if others not set', () => {
      process.env.SUPABASE_DIRECT_URL = 'postgres://user:pass@localhost:5432/db';
      const result = resolveDatabaseUrl();
      expect(result).toBe('postgres://user:pass@localhost:5432/db');
    });

    it('should return undefined if no database URL set', () => {
      const result = resolveDatabaseUrl();
      expect(result).toBeUndefined();
    });

    it('should set DATABASE_URL from alias', () => {
      process.env.SUPABASE_DB_URL = 'postgres://user:pass@localhost:5432/db';
      resolveDatabaseUrl();
      expect(process.env.DATABASE_URL).toBe('postgres://user:pass@localhost:5432/db');
    });
  });
});
