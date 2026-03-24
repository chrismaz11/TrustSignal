import { compactVerify, importJWK, type JWK } from 'jose';

import type { TrustRegistry } from './types.js';
import { canonicalizeJson } from './canonicalize.js';

export async function verifyRegistrySignature(
  registry: TrustRegistry,
  signature: string,
  publicJwk: JWK
): Promise<boolean> {
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
  return (
    registry.ronProviders.find((provider) => provider.id === providerId) || null
  );
}
