import type {
  BundleInput,
  DeedParsed,
  Receipt,
  VerificationReport
} from '../../../../packages/public-contracts/dist/index.js';
import type {
  RegistryBatchVerifyResult,
  RegistryOracleJobView,
  RegistrySourceId,
  RegistrySourceSummary,
  RegistryVerifyResult
} from '../registry/catalog.js';

export type RegistryScreeningInput = {
  subjectName?: string;
  sourceIds?: string[];
  forceRefresh?: boolean;
};

export type EngineVerificationInput = BundleInput & {
  registryScreening?: RegistryScreeningInput;
};

export type EngineAnchorState = {
  status: string;
  txHash?: string;
  chainId?: string;
  anchorId?: string;
  anchoredAt?: string;
  subjectDigest: string;
  subjectVersion: string;
};

export type CreatedVerification = {
  receipt: Receipt;
  revoked: boolean;
  anchor: EngineAnchorState;
};

export type StoredReceiptView = {
  receipt: Receipt;
  canonicalReceipt: string;
  revoked: boolean;
  anchor: EngineAnchorState;
};

export type VerificationStatus = {
  verified: boolean;
  integrityVerified: boolean;
  signatureVerified: boolean;
  signatureStatus: 'verified' | 'invalid' | 'unknown-kid' | 'legacy-unsigned';
  signatureReason?: string;
  proofVerified: boolean;
  recomputedHash: string;
  storedHash: string;
  inputsCommitment: string;
  receiptSignature: {
    alg: 'EdDSA';
    kid: string;
  } | null;
  revoked: boolean;
};

export type AnchorReceiptResult =
  | { kind: 'not_found' }
  | { kind: 'proof_artifact_required' }
  | { kind: 'anchored'; anchor: EngineAnchorState };

export type RevokeReceiptResult =
  | { kind: 'not_found' }
  | { kind: 'already_revoked' }
  | { kind: 'revoked' };

export interface VerificationEngine {
  createVerification(input: EngineVerificationInput): Promise<CreatedVerification>;
  createSyntheticBundle(): Promise<BundleInput>;
  crossCheckAttom(deed: DeedParsed): Promise<VerificationReport>;
  getReceipt(receiptId: string): Promise<StoredReceiptView | null>;
  getRegistryOracleJob(jobId: string): Promise<RegistryOracleJobView | null>;
  listRegistryOracleJobs(limit?: number): Promise<RegistryOracleJobView[]>;
  listRegistrySources(): Promise<RegistrySourceSummary[]>;
  verifyRegistrySource(input: {
    sourceId: RegistrySourceId;
    subject: string;
    forceRefresh?: boolean;
  }): Promise<RegistryVerifyResult>;
  verifyRegistrySources(input: {
    sourceIds: RegistrySourceId[];
    subject: string;
    forceRefresh?: boolean;
  }): Promise<RegistryBatchVerifyResult>;
  getVerificationStatus(receiptId: string): Promise<VerificationStatus | null>;
  getVantaVerificationResult(
    receiptId: string
  ): Promise<Record<string, unknown> | null>;
  anchorReceipt(receiptId: string): Promise<AnchorReceiptResult>;
  revokeReceipt(receiptId: string): Promise<RevokeReceiptResult>;
}
