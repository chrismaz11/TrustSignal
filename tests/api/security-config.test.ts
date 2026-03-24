import { generateKeyPairSync } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildSecurityConfig } from '../../apps/api/src/security.js';

type EnvSnapshot = Record<string, string | undefined>;

function snapshotEnv(keys: string[]): EnvSnapshot {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

function applyProductionReceiptSigningEnv() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK = JSON.stringify(privateKey.export({ format: 'jwk' }));
  process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK = JSON.stringify(publicKey.export({ format: 'jwk' }));
  process.env.TRUSTSIGNAL_RECEIPT_SIGNING_KID = 'test-kid';
}

describe('API security config', () => {
  let envSnapshot: EnvSnapshot;

  beforeEach(() => {
    envSnapshot = snapshotEnv([
      'NODE_ENV',
      'API_KEYS',
      'API_KEY_SCOPES',
      'API_KEY_DEFAULT_SCOPES',
      'TRUSTSIGNAL_API_KEY',
      'TRUSTSIGNAL_API_KEY_SCOPES',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_KID'
    ]);
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
  });

  it('accepts TRUSTSIGNAL_API_KEY without duplicating it in API_KEYS', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
    delete process.env.API_KEY_DEFAULT_SCOPES;
    process.env.TRUSTSIGNAL_API_KEY = 'canonical-live-key';
    delete process.env.TRUSTSIGNAL_API_KEY_SCOPES;
    applyProductionReceiptSigningEnv();

    const config = buildSecurityConfig();

    expect(config.apiKeys.has('canonical-live-key')).toBe(true);
    expect(Array.from(config.apiKeys.get('canonical-live-key') ?? [])).toEqual(['verify', 'read']);
  });

  it('allows TRUSTSIGNAL_API_KEY_SCOPES to override the canonical key scopes', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
    process.env.TRUSTSIGNAL_API_KEY = 'canonical-live-key';
    process.env.TRUSTSIGNAL_API_KEY_SCOPES = 'verify|read|anchor';
    applyProductionReceiptSigningEnv();

    const config = buildSecurityConfig();

    expect(Array.from(config.apiKeys.get('canonical-live-key') ?? [])).toEqual(['verify', 'read', 'anchor']);
  });

  it('still fails fast in production when no API key source is configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.API_KEYS;
    delete process.env.API_KEY_SCOPES;
    delete process.env.TRUSTSIGNAL_API_KEY;
    delete process.env.TRUSTSIGNAL_API_KEY_SCOPES;
    applyProductionReceiptSigningEnv();

    expect(() => buildSecurityConfig()).toThrow('API_KEYS or TRUSTSIGNAL_API_KEY is required in production');
  });
});
