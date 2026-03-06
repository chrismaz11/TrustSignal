import type { RevocationResult } from '../types/VerificationResult.js';
import { runHalo2Verifier } from './halo2Bridge.js';

export interface RevocationProofInput {
  bundleHash: string;
  revoked?: boolean;
}

export class RevocationVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RevocationVerificationError';
  }
}

export async function verifyRevocationProof(input: RevocationProofInput): Promise<RevocationResult> {
  if (!input.bundleHash.trim()) {
    throw new RevocationVerificationError('bundle hash is required for revocation proof verification');
  }

  try {
    const response = await runHalo2Verifier({
      mode: 'revocation',
      bundleHash: input.bundleHash,
      revoked: input.revoked
    });

    return {
      revocation_ok: response.ok,
      proof_gen_ms: response.proofGenMs,
      error: response.error
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new RevocationVerificationError(`revocation proof verification failed: ${message}`);
  }
}
