import { createHash } from 'node:crypto';

import type { CombinedResult, VerifyBundleInput } from '../types/VerificationResult.js';
import { verifyRevocationProof } from '../verifiers/revocationVerifier.js';
import { verifyZkml } from '../verifiers/zkmlVerifier.js';
import { verifyZkProof } from '../verifiers/zkProofVerifier.js';

function computeBundleHash(input: VerifyBundleInput): string {
  if (input.bundle_hash && input.bundle_hash.trim()) {
    return input.bundle_hash.trim();
  }

  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
}

export async function verifyBundle(input: VerifyBundleInput): Promise<CombinedResult> {
  const bundleHash = computeBundleHash(input);
  const revoked = Array.isArray(input.revoked_nullifiers) && input.revoked_nullifiers.includes(bundleHash);

  const [nonMemResult, revocationResult, zkmlResult] = await Promise.all([
    verifyZkProof({ bundleHash, tampered: input.tampered }),
    verifyRevocationProof({ bundleHash, revoked }),
    verifyZkml(input.deed_features)
  ]);

  return {
    non_mem_ok: nonMemResult.non_mem_ok,
    revocation_ok: revocationResult.revocation_ok,
    zkml_ok: zkmlResult.proven,
    fraud_score: zkmlResult.fraud_score,
    proof_gen_ms: Math.max(
      nonMemResult.proof_gen_ms,
      revocationResult.proof_gen_ms,
      zkmlResult.proof_gen_ms
    ),
    timestamp: new Date().toISOString(),
    bundle_hash: bundleHash
  };
}
