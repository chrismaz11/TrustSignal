import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/verifiers/halo2Bridge.js', () => ({
  runHalo2Verifier: vi.fn()
}));

import { runHalo2Verifier } from '../../src/verifiers/halo2Bridge.js';
import {
  RevocationVerificationError,
  verifyRevocationProof
} from '../../src/verifiers/revocationVerifier.js';

describe('RevocationVerificationError', () => {
  it('has correct name and message', () => {
    const error = new RevocationVerificationError('test message');
    expect(error.name).toBe('RevocationVerificationError');
    expect(error.message).toBe('test message');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(RevocationVerificationError);
  });
});

describe('verifyRevocationProof', () => {
  it('throws RevocationVerificationError when bundleHash is empty', async () => {
    await expect(verifyRevocationProof({ bundleHash: '' })).rejects.toThrow(RevocationVerificationError);
    await expect(verifyRevocationProof({ bundleHash: '' })).rejects.toThrow(
      'bundle hash is required for revocation proof verification'
    );
  });

  it('throws RevocationVerificationError when bundleHash is only whitespace', async () => {
    await expect(verifyRevocationProof({ bundleHash: '   ' })).rejects.toThrow(RevocationVerificationError);
  });

  it('returns revocation_ok true when halo2 bridge confirms', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({
      ok: true,
      proofGenMs: 50
    });

    const result = await verifyRevocationProof({ bundleHash: 'bundle-001' });

    expect(result.revocation_ok).toBe(true);
    expect(result.proof_gen_ms).toBe(50);
    expect(result.error).toBeUndefined();
  });

  it('returns revocation_ok false when halo2 bridge denies', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({
      ok: false,
      proofGenMs: 30,
      error: 'proof invalid'
    });

    const result = await verifyRevocationProof({ bundleHash: 'bundle-revoked' });

    expect(result.revocation_ok).toBe(false);
    expect(result.error).toBe('proof invalid');
  });

  it('passes revoked=true flag to halo2 bridge', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({ ok: true, proofGenMs: 10 });

    await verifyRevocationProof({ bundleHash: 'bundle-x', revoked: true });

    expect(vi.mocked(runHalo2Verifier)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'revocation', bundleHash: 'bundle-x', revoked: true })
    );
  });

  it('passes revoked=false when revoked is not provided', async () => {
    vi.mocked(runHalo2Verifier).mockResolvedValueOnce({ ok: true, proofGenMs: 10 });

    await verifyRevocationProof({ bundleHash: 'bundle-y' });

    expect(vi.mocked(runHalo2Verifier)).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'revocation', bundleHash: 'bundle-y' })
    );
  });

  it('wraps halo2 bridge Error in RevocationVerificationError with correct message', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce(new Error('binary not found'));

    await expect(verifyRevocationProof({ bundleHash: 'bundle-fail' })).rejects.toThrow(
      'revocation proof verification failed: binary not found'
    );
  });

  it('thrown error is an instance of RevocationVerificationError', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce(new Error('connection refused'));

    await expect(verifyRevocationProof({ bundleHash: 'bundle-fail-type' })).rejects.toBeInstanceOf(
      RevocationVerificationError
    );
  });

  it('wraps non-Error rejections from halo2 bridge in RevocationVerificationError', async () => {
    vi.mocked(runHalo2Verifier).mockRejectedValueOnce('string-error');

    await expect(verifyRevocationProof({ bundleHash: 'bundle-str-err' })).rejects.toThrow(
      'revocation proof verification failed: string-error'
    );
  });
});
