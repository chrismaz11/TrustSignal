import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VerifyBundleInput } from '../../src/types/VerificationResult.js';

vi.mock('../../src/verifiers/zkmlVerifier.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/verifiers/zkmlVerifier.js')>(
    '../../src/verifiers/zkmlVerifier.js'
  );
  return {
    ...actual,
    verifyZkml: vi.fn()
  };
});

const { verifyBundle } = await import('../../src/core/verifyBundle.js');
const { verifyZkml } = await import('../../src/verifiers/zkmlVerifier.js');

interface MockZkmlResponse {
  proven: boolean;
  fraud_score: number;
  proof_gen_ms: number;
  error?: string;
}

const mockedVerifyZkml = vi.mocked(verifyZkml);
const baseFeatures = [0.42, -0.18, 0.31, 0.22, -0.09, 0.58] as const;

function buildInput(overrides: Partial<VerifyBundleInput> = {}): VerifyBundleInput {
  return {
    deed_features: [...baseFeatures],
    ...overrides
  };
}

function mockEzklChildProcess(response: MockZkmlResponse): void {
  mockedVerifyZkml.mockResolvedValue({
    proven: response.proven,
    fraud_score: response.fraud_score,
    proof_gen_ms: response.proof_gen_ms,
    error: response.error
  });
}

describe('full bundle verification', () => {
  beforeEach(() => {
    mockedVerifyZkml.mockReset();
  });

  afterEach(() => {
    mockedVerifyZkml.mockReset();
  });

  it('verifies a valid bundle', { timeout: 30_000 }, async () => {
    mockEzklChildProcess({ proven: true, fraud_score: 0.14, proof_gen_ms: 1506 });

    const result = await verifyBundle(buildInput());

    expect(result.non_mem_ok).toBe(true);
    expect(result.revocation_ok).toBe(true);
    expect(result.zkml_ok).toBe(true);
    expect(result.fraud_score).toBe(0.14);
    expect(result.proof_gen_ms).toBeGreaterThan(0);
    expect(result.bundle_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('marks fraud as detected when zkml score is high', async () => {
    mockEzklChildProcess({ proven: true, fraud_score: 0.97, proof_gen_ms: 1508 });

    const result = await verifyBundle(buildInput());

    expect(result.zkml_ok).toBe(true);
    expect(result.fraud_score).toBeGreaterThan(0.9);
  });

  it('fails revocation check for a revoked deed', async () => {
    mockEzklChildProcess({ proven: true, fraud_score: 0.23, proof_gen_ms: 1504 });

    const revokedHash = 'revoked-bundle-hash';
    const result = await verifyBundle(
      buildInput({
        bundle_hash: revokedHash,
        revoked_nullifiers: [revokedHash]
      })
    );

    expect(result.non_mem_ok).toBe(true);
    expect(result.revocation_ok).toBe(false);
    expect(result.zkml_ok).toBe(true);
  });

  it('fails non-membership check for a tampered bundle', async () => {
    mockEzklChildProcess({ proven: true, fraud_score: 0.45, proof_gen_ms: 1510 });

    const result = await verifyBundle(
      buildInput({
        tampered: true
      })
    );

    expect(result.non_mem_ok).toBe(false);
    expect(result.revocation_ok).toBe(true);
    expect(result.zkml_ok).toBe(true);
  });

  it('handles empty revocation DB edge case', async () => {
    mockEzklChildProcess({ proven: true, fraud_score: 0.19, proof_gen_ms: 1498 });

    const result = await verifyBundle(
      buildInput({
        bundle_hash: 'empty-db-case',
        revoked_nullifiers: []
      })
    );

    expect(result.revocation_ok).toBe(true);
    expect(result.bundle_hash).toBe('empty-db-case');
  });
});
