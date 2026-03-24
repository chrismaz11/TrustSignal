import { generateKeyPairSync } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { buildReceiptSigningConfig } from './security.js';

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

describe.sequential('receipt-signing config env aliases', () => {
  it('accepts TRUSTSIGNAL_SIGNING_* with TRUSTSIGNAL_PUBLIC_JWKS', () => {
    const keysToSnapshot = [
      'NODE_ENV',
      'TRUSTSIGNAL_SIGNING_KEY_ID',
      'TRUSTSIGNAL_SIGNING_PRIVATE_JWK',
      'TRUSTSIGNAL_PUBLIC_JWKS',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS',
      'TRUSTSIGNAL_RECEIPT_SIGNING_KID'
    ];
    const envSnapshot = snapshotEnv(keysToSnapshot);

    try {
      const kid = 'alias-test-receipt-signer-v1';
      const { privateKey, publicKey } = generateKeyPairSync('ed25519');
      const privateJwk = privateKey.export({ format: 'jwk' });
      const publicJwk = publicKey.export({ format: 'jwk' });

      process.env.NODE_ENV = 'production';
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK;
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK;
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS;
      delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_KID;

      process.env.TRUSTSIGNAL_SIGNING_KEY_ID = kid;
      process.env.TRUSTSIGNAL_SIGNING_PRIVATE_JWK = JSON.stringify(privateJwk);
      process.env.TRUSTSIGNAL_PUBLIC_JWKS = JSON.stringify({ [kid]: publicJwk });

      const config = buildReceiptSigningConfig(process.env);
      expect(config.mode).toBe('configured');
      expect(config.current.kid).toBe(kid);
      expect(config.verificationKeys.get(config.current.kid)).toEqual(config.current.publicJwk);
    } finally {
      restoreEnv(envSnapshot);
    }
  });
});

