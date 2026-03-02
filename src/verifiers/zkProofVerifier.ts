import type { NonMemResult } from '../types/VerificationResult.js';
import { runHalo2Verifier } from './halo2Bridge.js';

export interface NonMemProofInput {
  bundleHash: string;
  tampered?: boolean;
}

export class ZkProofVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ZkProofVerificationError';
  }
}

export async function verifyZkProof(input: NonMemProofInput): Promise<NonMemResult> {
  if (!input.bundleHash.trim()) {
    throw new ZkProofVerificationError('bundle hash is required for non-membership proof verification');
  }

  try {
    const response = await runHalo2Verifier({
      mode: 'non-mem',
      bundleHash: input.bundleHash,
      tampered: input.tampered
    });

    return {
      non_mem_ok: response.ok,
      proof_gen_ms: response.proofGenMs,
      error: response.error
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ZkProofVerificationError(`non-membership proof verification failed: ${message}`);
  }
}
