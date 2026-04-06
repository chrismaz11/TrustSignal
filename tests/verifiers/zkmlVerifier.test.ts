import { afterEach, describe, expect, it } from 'vitest';

import { ZkmlVerificationError, verifyZkml } from '../../src/verifiers/zkmlVerifier.js';

describe('ZkmlVerificationError', () => {
  it('has correct name and message', () => {
    const error = new ZkmlVerificationError('test message');
    expect(error.name).toBe('ZkmlVerificationError');
    expect(error.message).toBe('test message');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(ZkmlVerificationError);
  });
});

describe('verifyZkml – input validation', () => {
  it('throws ZkmlVerificationError when feature vector has too few elements', async () => {
    await expect(verifyZkml([0.1, 0.2, 0.3])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([0.1, 0.2, 0.3])).rejects.toThrow(
      'invalid feature vector length: expected 6, got 3'
    );
  });

  it('throws ZkmlVerificationError when feature vector has too many elements', async () => {
    await expect(verifyZkml([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7])).rejects.toThrow(
      'invalid feature vector length: expected 6, got 7'
    );
  });

  it('throws ZkmlVerificationError when feature vector is empty', async () => {
    await expect(verifyZkml([])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([])).rejects.toThrow('invalid feature vector length: expected 6, got 0');
  });

  it('throws ZkmlVerificationError when a feature value is NaN', async () => {
    await expect(verifyZkml([0.1, 0.2, Number.NaN, 0.4, 0.5, 0.6])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([0.1, 0.2, Number.NaN, 0.4, 0.5, 0.6])).rejects.toThrow(
      'feature at index 2 is not a finite number'
    );
  });

  it('throws ZkmlVerificationError when a feature value is Infinity', async () => {
    await expect(verifyZkml([0.1, 0.2, 0.3, Infinity, 0.5, 0.6])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([0.1, 0.2, 0.3, Infinity, 0.5, 0.6])).rejects.toThrow(
      'feature at index 3 is not a finite number'
    );
  });

  it('throws ZkmlVerificationError when a feature value is -Infinity', async () => {
    await expect(verifyZkml([0.1, 0.2, 0.3, 0.4, -Infinity, 0.6])).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml([0.1, 0.2, 0.3, 0.4, -Infinity, 0.6])).rejects.toThrow(
      'feature at index 4 is not a finite number'
    );
  });

  it('throws ZkmlVerificationError when first feature is non-finite', async () => {
    await expect(verifyZkml([NaN, 0.2, 0.3, 0.4, 0.5, 0.6])).rejects.toThrow(
      'feature at index 0 is not a finite number'
    );
  });
});

describe('verifyZkml – execution paths', () => {
  const validFeatures: readonly number[] = [0.42, 2, 1, 0.01, 0.35, 0.5];

  const savedMode = process.env.TRUSTSIGNAL_ZKML_MODE;

  afterEach(() => {
    if (savedMode === undefined) {
      delete process.env.TRUSTSIGNAL_ZKML_MODE;
    } else {
      process.env.TRUSTSIGNAL_ZKML_MODE = savedMode;
    }
  });

  it('throws ZkmlVerificationError when Python mode fails (ezkl not installed)', async () => {
    process.env.TRUSTSIGNAL_ZKML_MODE = 'python';

    await expect(verifyZkml(validFeatures)).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml(validFeatures)).rejects.toThrow(/python ezkl bridge failed/);
  });

  it('throws ZkmlVerificationError when both JS and Python paths fail', async () => {
    delete process.env.TRUSTSIGNAL_ZKML_MODE;

    await expect(verifyZkml(validFeatures)).rejects.toThrow(ZkmlVerificationError);
    await expect(verifyZkml(validFeatures)).rejects.toThrow(/zkml verification failed/);
  });

  it('error message includes both JS and Python failure details', async () => {
    delete process.env.TRUSTSIGNAL_ZKML_MODE;

    await expect(verifyZkml(validFeatures)).rejects.toThrow(/js:.*python fallback:/);
  });
});


