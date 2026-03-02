export interface NonMemResult {
  non_mem_ok: boolean;
  proof_gen_ms: number;
  error?: string;
}

export interface RevocationResult {
  revocation_ok: boolean;
  proof_gen_ms: number;
  error?: string;
}

export interface ZkmlResult {
  proven: boolean;
  fraud_score: number;
  proof_gen_ms: number;
  error?: string;
}

export interface CombinedResult {
  non_mem_ok: boolean;
  revocation_ok: boolean;
  zkml_ok: boolean;
  fraud_score: number;
  proof_gen_ms: number;
  timestamp: string;
  bundle_hash: string;
}

export interface VerifyBundleInput {
  deed_features: readonly number[];
  bundle_hash?: string;
  tampered?: boolean;
  revoked_nullifiers?: readonly string[];
}
