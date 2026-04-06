import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/verifiers/halo2Bridge.js', () => ({
  runHalo2Verifier: vi.fn()
}));

import { runHalo2Verifier } from '../../src/verifiers/halo2Bridge.js';
import {
  ZkProofVerificationError,
  verifyZkProof
} from '../../src/verifiers/zkProofVerifier.js';

describe('ZkProofVerificationError', () => {
  it('has correct name and message', () => {
    const error = new ZkProofVerificationError('test message');
    expect(error.name).toBe('ZkProofVerificationError');
    expect(error.message).toBe('test message');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ZkProofVerificationError);
  });
});

describe('verifyZkProof', () => {
  it('throws ZkProofVerificationError when bundleHash is empty', async () => {
    await expect(verifyZkProof({ bundleHash: '' })).rejects.toThrow(ZkProofVerificationError);
    await expect(verifyZkProof({ bundleHash: '' })).rejects.toThrow(
      'bundle hash is required for non-membership proof verification'
    );
  });

  it('throws ZkProofVerificationError when bundleHash is only whitespace', async () => {
    await expect(verifyZkProof({ bundleHash: '   ' })).rejects.toThrow(ZkProofVerificationError);
  });

  it('returns non_mem_ok true when halo2 bridge confirms', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({
      ok: true,
      proofGenMs: 42
    });

    const result = await verifyZkProof({ bundleHash: 'bundle-001' });

    expect(result.non_mem_ok).toBe(true);
    expect(result.proof_gen_ms).toBe(42);
    expect(result.error).toBeUndefined();
  });

  it('returns non_mem_ok false when halo2 bridge denies', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({
      ok: false,
      proofGenMs: 25,
      error: 'non-membership proof invalid'
    });

    const result = await verifyZkProof({ bundleHash: 'bundle-tampered' });

    expect(result.non_mem_ok).toBe(false);
    expect(result.error).toBe('non-membership proof invalid');
  });

  it('passes tampered=true flag to halo2 bridge', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({ ok: false, proofGenMs: 10 });

    await verifyZkProof({ bundleHash: 'bundle-x', tampered: true });

    expect(vi.mocked(runHalo2Verifier)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'non-mem', bundleHash: 'bundle-x', tampered: true })
    );
  });

  it('calls halo2 bridge in non-mem mode', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({ ok: true, proofGenMs: 10 });

    await verifyZkProof({ bundleHash: 'bundle-y' });

    expect(vi.mocked(runHalo2Verifier)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'non-mem' })
    );
  });

  it('wraps halo2 bridge Error in ZkProofVerificationError with correct message', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce(new Error('binary missing'));

    await expect(verifyZkProof({ bundleHash: 'bundle-fail' })).rejects.toThrow(
      'non-membership proof verification failed: binary missing'
    );
  });

  it('thrown error is an instance of ZkProofVerificationError', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce(new Error('connection timeout'));

    await expect(verifyZkProof({ bundleHash: 'bundle-fail-type' })).rejects.toBeInstanceOf(
      ZkProofVerificationError
    );
  });

  it('wraps non-Error rejections from halo2 bridge in ZkProofVerificationError', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce(42);

    await expect(verifyZkProof({ bundleHash: 'bundle-num-err' })).rejects.toThrow(
      'non-membership proof verification failed: 42'
    );
  });
});
