import { readFile } from 'fs/promises';
import path from 'path';

import { TrustRegistry, verifyRegistrySignature } from '../../../packages/core/dist/index.js';

const registryDir = path.resolve(__dirname, '../../../packages/core/registry');

export async function loadRegistry(): Promise<TrustRegistry> {
  const registryPath = path.join(registryDir, 'registry.json');
  const signaturePath = path.join(registryDir, 'registry.sig');
  const publicKeyPath = path.join(registryDir, 'registry.public.jwk');
  const publicKeyOverride = process.env.TRUST_REGISTRY_PUBLIC_KEY?.trim();

  if (process.env.NODE_ENV === 'production' && !publicKeyOverride) {
    throw new Error('CRITICAL SECURITY: TRUST_REGISTRY_PUBLIC_KEY environment variable is required in production.');
  }

  const [registryRaw, signatureRaw, publicKeyFileRaw] = await Promise.all([
    readFile(registryPath, 'utf-8'),
    readFile(signaturePath, 'utf-8'),
    readFile(publicKeyPath, 'utf-8')
  ]);

  const registry = JSON.parse(registryRaw) as TrustRegistry;
  const signature = signatureRaw.trim();
  const publicJwk = JSON.parse(publicKeyOverride || publicKeyFileRaw);

  const verified = await verifyRegistrySignature(registry, signature, publicJwk);
  if (!verified) {
    throw new Error('Registry signature invalid');
  }

  return registry;
}
