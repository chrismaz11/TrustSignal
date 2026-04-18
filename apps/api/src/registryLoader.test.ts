import * as fsPromises from 'fs/promises';

import { generateRegistryKeypair, signRegistry } from '@trustsignal/core';
import { afterEach, beforeEach, describe, expect, it, vi, type MockedFunction } from 'vitest';

import { loadRegistry } from './registryLoader.js';

type RegistryFixture = {
  version: string;
  issuedAt: string;
  issuer: string;
  signingKeyId: string;
  ronProviders: [];
  notaries: [];
};
type PublicJwk = Awaited<ReturnType<typeof generateRegistryKeypair>>['publicJwk'];
const readFileMock = fsPromises.readFile as MockedFunction<typeof fsPromises.readFile>;

// Mock out the fs/promises module to return custom registry and signature files
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    readFile: vi.fn(),
  };
});

describe('registryLoader', () => {
  let validRegistry: RegistryFixture;
  let validSignature: string;
  let publicJwk: PublicJwk;

  beforeEach(async () => {
    // Save original env
    vi.stubEnv('NODE_ENV', 'test');
    
    // Generate valid mock registry
    validRegistry = {
      version: '1.0',
      issuedAt: new Date().toISOString(),
      issuer: 'Test',
      signingKeyId: 'test-key',
      ronProviders: [],
      notaries: []
    };
    
    const keypair = await generateRegistryKeypair();
    publicJwk = keypair.publicJwk;
    validSignature = await signRegistry(validRegistry, keypair.privateJwk, validRegistry.signingKeyId);

    // Mock TRUST_REGISTRY_PUBLIC_KEY logic (tests DEV fallback without ENV)
    vi.stubEnv('TRUST_REGISTRY_PUBLIC_KEY', JSON.stringify(publicJwk));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it('loads valid registry successfully', async () => {
    // Setup fs.readFile mock to return our valid files
    readFileMock.mockImplementation((filepath: fsPromises.PathLike) => {
      const pathname = String(filepath);
      if (pathname.endsWith('registry.json')) return Promise.resolve(JSON.stringify(validRegistry));
      if (pathname.endsWith('registry.sig')) return Promise.resolve(validSignature);
      if (pathname.endsWith('registry.public.jwk')) return Promise.resolve(JSON.stringify(publicJwk));
      return Promise.reject(new Error(`File not found: ${pathname}`));
    });

    const registry = await loadRegistry();
    expect(registry.version).toBe('1.0');
    expect(registry.issuer).toBe('Test');
  });

  it('rejects if signature does not match (tampered payload)', async () => {
    // Tamper with the registry after signing
    const tamperedRegistry = { ...validRegistry, issuer: 'Hacked Issuer' };

    readFileMock.mockImplementation((filepath: fsPromises.PathLike) => {
      const pathname = String(filepath);
      if (pathname.endsWith('registry.json')) return Promise.resolve(JSON.stringify(tamperedRegistry));
      if (pathname.endsWith('registry.sig')) return Promise.resolve(validSignature);
      if (pathname.endsWith('registry.public.jwk')) return Promise.resolve(JSON.stringify(publicJwk));
      return Promise.reject(new Error(`File not found: ${pathname}`));
    });

    await expect(loadRegistry()).rejects.toThrow('Registry signature invalid');
  });

  it('rejects if signature is from a different key', async () => {
    // Sign with a different key
    const hackerKeypair = await generateRegistryKeypair();
    const hackerSignature = await signRegistry(validRegistry, hackerKeypair.privateJwk, validRegistry.signingKeyId);

    readFileMock.mockImplementation((filepath: fsPromises.PathLike) => {
      const pathname = String(filepath);
      if (pathname.endsWith('registry.json')) return Promise.resolve(JSON.stringify(validRegistry));
      if (pathname.endsWith('registry.sig')) return Promise.resolve(hackerSignature);
      if (pathname.endsWith('registry.public.jwk')) return Promise.resolve(JSON.stringify(publicJwk));
      return Promise.reject(new Error(`File not found: ${pathname}`));
    });

    await expect(loadRegistry()).rejects.toThrow();
  });

  it('requires TRUST_REGISTRY_PUBLIC_KEY in production mode', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRUST_REGISTRY_PUBLIC_KEY', ''); // Unset it explicitly for test
    delete process.env.TRUST_REGISTRY_PUBLIC_KEY; // Force removal

    // Set mock so reading valid dev files could occur, but it shouldn't get there
    readFileMock.mockImplementation((filepath: fsPromises.PathLike) => {
      const pathname = String(filepath);
      if (pathname.endsWith('registry.json')) return Promise.resolve(JSON.stringify(validRegistry));
      if (pathname.endsWith('registry.sig')) return Promise.resolve(validSignature);
      if (pathname.endsWith('registry.public.jwk')) return Promise.resolve(JSON.stringify(publicJwk));
      return Promise.reject(new Error(`File not found: ${pathname}`));
    });

    await expect(loadRegistry()).rejects.toThrow('CRITICAL SECURITY: TRUST_REGISTRY_PUBLIC_KEY environment variable is required in production.');
  });
});
