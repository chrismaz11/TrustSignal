import { describe, it, expect, vi } from 'vitest';
import { loadRegistry } from '../../registryLoader.js';
import { verifyRegistrySignature } from '../../../../packages/core/dist/index.js';
import { readFile } from 'fs/promises';

vi.mock('fs/promises');
vi.mock('../../../../packages/core/dist/index.js');

describe('loadRegistry', () => {
  const mockRegistry = { version: '1.0', rules: [] };
  const mockSignature = 'mock-signature';
  const mockPublicJwk = { kty: 'EC', crv: 'P-256', x: '1', y: '2' };

  it('should load and verify registry in production with env override', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_REGISTRY_PUBLIC_KEY = JSON.stringify(mockPublicJwk);

    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockRegistry));
    vi.mocked(readFile).mockResolvedValueOnce(mockSignature);
    vi.mocked(verifyRegistrySignature).mockResolvedValue(true);

    const result = await loadRegistry();
    expect(result).toEqual(mockRegistry);
  });

  it('should throw if TRUST_REGISTRY_PUBLIC_KEY is missing in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_REGISTRY_PUBLIC_KEY;

    await expect(loadRegistry()).rejects.toThrow('CRITICAL SECURITY: TRUST_REGISTRY_PUBLIC_KEY environment variable is required in production.');
  });

  it('should load registry in non-production without env override', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TRUST_REGISTRY_PUBLIC_KEY;

    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockRegistry));
    vi.mocked(readFile).mockResolvedValueOnce(mockSignature);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockPublicJwk));
    vi.mocked(verifyRegistrySignature).mockResolvedValue(true);

    const result = await loadRegistry();
    expect(result).toEqual(mockRegistry);
  });

  it('should throw if registry signature is invalid', async () => {
    process.env.NODE_ENV = 'development';

    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockRegistry));
    vi.mocked(readFile).mockResolvedValueOnce(mockSignature);
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockPublicJwk));
    vi.mocked(verifyRegistrySignature).mockResolvedValue(false);

    await expect(loadRegistry()).rejects.toThrow('Registry signature invalid');
  });

  it('should throw if registry file is invalid JSON', async () => {
    process.env.NODE_ENV = 'development';

    vi.mocked(readFile).mockResolvedValueOnce('invalid json');

    await expect(loadRegistry()).rejects.toThrow();
  });

  it('should throw if public key file is invalid JSON', async () => {
    process.env.NODE_ENV = 'development';

    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(mockRegistry));
    vi.mocked(readFile).mockResolvedValueOnce(mockSignature);
    vi.mocked(readFile).mockResolvedValueOnce('invalid json');

    await expect(loadRegistry()).rejects.toThrow();
  });
});
