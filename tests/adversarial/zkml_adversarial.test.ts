import * as childProcess from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { verifyZkml } from '../../src/verifiers/zkmlVerifier.js';

vi.mock('node:child_process', async () => {
  const actual = await vi.importActual<typeof import('node:child_process')>('node:child_process');
  return {
    ...actual,
    execFile: vi.fn()
  };
});

type CaseCategory = 'perturbation' | 'edge' | 'fraud';

interface AdversarialCase {
  name: string;
  category: CaseCategory;
  features: readonly number[];
  minScore?: number;
  maxScore?: number;
}

const perturbationCases: readonly AdversarialCase[] = [
  { name: 'boundary_shift_01', category: 'perturbation', features: [0.51, 1.01, 0.99, 0.52, 0.98, 0.5] },
  { name: 'boundary_shift_02', category: 'perturbation', features: [0.5, 1.0, 1.0, 0.49, 1.02, 0.48] },
  { name: 'boundary_shift_03', category: 'perturbation', features: [0.48, 1.02, 1.0, 0.5, 1.01, 0.52] },
  { name: 'boundary_shift_04', category: 'perturbation', features: [0.52, 0.99, 1.01, 0.51, 0.99, 0.49] },
  { name: 'boundary_shift_05', category: 'perturbation', features: [0.49, 1.01, 0.98, 0.53, 1.03, 0.5] },
  { name: 'boundary_shift_06', category: 'perturbation', features: [0.5, 0.97, 1.02, 0.48, 1.0, 0.51] },
  { name: 'boundary_shift_07', category: 'perturbation', features: [0.47, 1.03, 0.99, 0.5, 0.97, 0.52] },
  { name: 'boundary_shift_08', category: 'perturbation', features: [0.53, 1.0, 1.01, 0.47, 1.02, 0.48] },
  { name: 'boundary_shift_09', category: 'perturbation', features: [0.5, 1.02, 0.97, 0.5, 0.99, 0.53] },
  { name: 'boundary_shift_10', category: 'perturbation', features: [0.46, 0.99, 1.03, 0.52, 1.01, 0.49] }
];

const edgeCases: readonly AdversarialCase[] = [
  { name: 'all_zeros', category: 'edge', features: [0, 0, 0, 0, 0, 0], minScore: 0.5, maxScore: 0.5 },
  { name: 'all_max', category: 'edge', features: [1, 1, 1, 1, 1, 1], minScore: 0.62, maxScore: 0.63 },
  { name: 'single_feature_flip_notary', category: 'edge', features: [0.4, 1, 0, 0.3, 0.5, 0.6] },
  { name: 'single_feature_flip_amount', category: 'edge', features: [0.4, 1, 1, 0.3, 3.5, 0.6], minScore: 0.65 },
  { name: 'single_feature_flip_hash_signal', category: 'edge', features: [0.4, 1, 1, 0.3, 0.5, 0] }
];

const knownFraudPatternCases: readonly AdversarialCase[] = [
  {
    name: 'high_amount_no_notary',
    category: 'fraud',
    features: [0.95, 0.1, 0, 2.8, 5.2, 0.9],
    minScore: 0.72
  },
  {
    name: 'stale_notarization_large_transfer',
    category: 'fraud',
    features: [0.8, 0.2, 0, 6.0, 4.8, 0.7],
    minScore: 0.72
  },
  {
    name: 'low_signature_count_high_value',
    category: 'fraud',
    features: [0.7, 0, 0, 1.5, 6.0, 0.85],
    minScore: 0.72
  },
  {
    name: 'compressed_text_high_amount',
    category: 'fraud',
    features: [0.15, 0.1, 0, 4.0, 5.5, 0.92],
    minScore: 0.72
  },
  {
    name: 'signature_mismatch_hash_anomaly',
    category: 'fraud',
    features: [0.88, 0.05, 0, 3.4, 4.6, 0.99],
    minScore: 0.72
  }
];

const allCases = [...perturbationCases, ...edgeCases, ...knownFraudPatternCases] as const;

function estimateFraudScore(features: readonly number[]): number {
  const weighted = features.reduce((total, value, index) => total + value * (index + 1), 0);
  const normalized = weighted / (features.length * (features.length + 1));
  const score = 1 / (1 + Math.exp(-normalized));
  if (score <= 0) return 0;
  if (score >= 1) return 1;
  return score;
}

const mockedExecFile = vi.mocked(childProcess.execFile);

describe('zkml adversarial robustness', () => {
  beforeEach(() => {
    process.env.TRUSTSIGNAL_ZKML_MODE = 'python';
    mockedExecFile.mockReset();
    mockedExecFile.mockImplementation((...args: unknown[]) => {
      const callback = args.find((value): value is childProcess.ExecFileCallback => typeof value === 'function');
      callback?.(null, 'python bridge output unavailable', '');
      return {
        pid: 0,
        kill: () => true
      } as unknown as childProcess.ChildProcess;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TRUSTSIGNAL_ZKML_MODE;
  });

  it('executes the expected 20 adversarial cases', async () => {
    expect(perturbationCases).toHaveLength(10);
    expect(edgeCases).toHaveLength(5);
    expect(knownFraudPatternCases).toHaveLength(5);
    expect(allCases).toHaveLength(20);

    for (const testCase of allCases) {
      const result = await verifyZkml(testCase.features);
      const expected = estimateFraudScore(testCase.features);

      expect(result.proven).toBe(true);
      expect(result.fraud_score).toBeCloseTo(expected, 10);
      expect(result.fraud_score).toBeGreaterThanOrEqual(0);
      expect(result.fraud_score).toBeLessThanOrEqual(1);
      expect(result.proof_gen_ms).toBeGreaterThanOrEqual(0);

      if (typeof testCase.minScore === 'number') {
        expect(result.fraud_score, `${testCase.name} minimum fraud score`).toBeGreaterThanOrEqual(
          testCase.minScore
        );
      }

      if (typeof testCase.maxScore === 'number') {
        expect(result.fraud_score, `${testCase.name} maximum fraud score`).toBeLessThanOrEqual(
          testCase.maxScore
        );
      }
    }

    expect(mockedExecFile).toHaveBeenCalledTimes(20);
  });
});
