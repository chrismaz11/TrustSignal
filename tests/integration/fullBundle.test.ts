import * as childProcess from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyBundle } from '../../src/core/verifyBundle.js';
import type { VerifyBundleInput } from '../../src/types/VerificationResult.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn()
  };
});

interface MockZkmlResponse {
  proven: boolean;
  fraud_score: number;
  proof_gen_ms: number;
  error?: string;
}

const mockedExecFile = vi.mocked(childProcess.execFile);
const baseFeatures = [0.42, -0.18, 0.31, 0.22, -0.09, 0.58] as const;

function buildInput(overrides: Partial<VerifyBundleInput> = {}): VerifyBundleInput {
  return {
    deed_features: [...baseFeatures],
    ...overrides
  };
}

function mockEzklChildProcess(response: MockZkmlResponse): void {
  mockedExecFile.mockImplementation(((
    ...args: unknown[]
  ) => {
    const callback = args.find((value): value is childProcess.ExecFileCallback => typeof value === 'function');
    if (callback) {
      callback(null, JSON.stringify(response), '');
    }
    return {
      pid: 0,
      kill: () => true
    } as unknown as childProcess.ChildProcess;
  }) as typeof childProcess.execFile);
}

describe('full bundle verification', () => {
  beforeEach(() => {
    process.env.TRUSTSIGNAL_ZKML_MODE = 'python';
    mockedExecFile.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TRUSTSIGNAL_ZKML_MODE;
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
