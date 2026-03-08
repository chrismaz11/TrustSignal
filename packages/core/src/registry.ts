import { webcrypto } from 'node:crypto';

import { CompactSign, compactVerify, generateKeyPair, importJWK, exportJWK, JWK } from 'jose';

import { canonicalizeJson } from './canonicalize.js';
import { TrustRegistry } from './types.js';

export type RegistrySignatureBundle = {
  registry: TrustRegistry;
  signature: string;
};

function ensureWebCrypto() {
  if (!globalThis.crypto) {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: webcrypto
    });
  }
}

export async function generateRegistryKeypair() {
  ensureWebCrypto();
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', {
    extractable: true
  });
  const publicJwk = await exportJWK(publicKey);
  const privateJwk = await exportJWK(privateKey);
  return { publicJwk, privateJwk };
}

export async function signRegistry(
  registry: TrustRegistry,
  privateJwk: JWK,
  keyId: string
): Promise<string> {
  ensureWebCrypto();
  const canonical = canonicalizeJson(registry);
  const encoder = new TextEncoder();
  const key = await importJWK(privateJwk, 'EdDSA');
  return new CompactSign(encoder.encode(canonical))
    .setProtectedHeader({ alg: 'EdDSA', kid: keyId, typ: 'registry+jws' })
    .sign(key);
}

export async function verifyRegistrySignature(
  registry: TrustRegistry,
  signature: string,
  publicJwk: JWK
): Promise<boolean> {
  ensureWebCrypto();
  const canonical = canonicalizeJson(registry);
  const encoder = new TextEncoder();
  const key = await importJWK(publicJwk, 'EdDSA');
  const { payload } = await compactVerify(signature, key);
  const payloadString = new TextDecoder().decode(payload);
  return payloadString === canonical && encoder.encode(canonical).length > 0;
}

export function findNotary(registry: TrustRegistry, notaryId: string) {
  return registry.notaries.find((notary) => notary.id === notaryId) || null;
}

export function findRonProvider(registry: TrustRegistry, providerId: string) {
  return registry.ronProviders.find((provider) => provider.id === providerId) || null;
}
