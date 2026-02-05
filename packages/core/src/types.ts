import { DocumentRisk } from './risk/types.js';
import { ZKPAttestation } from './zkp/types.js';

export type RonInput = {
  provider: string;
  notaryId: string;
  commissionState: string;
  sealPayload: string;
  sealScheme?: 'SIM-ECDSA-v1';
};

export type DocInput = {
  docHash: string;
  pdfBase64?: string;
};

export type PolicyInput = {
  profile: string;
};

export type PropertyInput = {
  parcelId: string;
  county: string;
  state: string;
};

export type OCRData = {
  notaryName?: string;
  notaryCommissionId?: string;
  propertyAddress?: string;
  grantorName?: string;
};

export type BundleInput = {
  bundleId: string;
  transactionType: string;
  ron: RonInput;
  doc: DocInput;
  property: PropertyInput;
  ocrData?: OCRData;
  policy: PolicyInput;
  timestamp?: string;
};

export type CountyCheckResult = {
  status: 'CLEAN' | 'FLAGGED' | 'LOCKED';
  details?: string;
};

export interface CountyVerifier {
  verifyParcel(parcelId: string, county: string, state: string): Promise<CountyCheckResult>;
}

export type CheckResult = {
  checkId: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
};

export type VerificationResult = {
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  reasons: string[];
  riskScore: number;
  checks: CheckResult[];
};

export type Receipt = {
  receiptVersion: string;
  receiptId: string;
  createdAt: string;
  policyProfile: string;
  inputsCommitment: string;
  checks: CheckResult[];
  decision: VerificationResult['decision'];
  reasons: string[];
  riskScore: number;
  verifierId: string;
  receiptHash: string;
  fraudRisk?: DocumentRisk;
  zkpAttestation?: ZKPAttestation;
};

export type TrustRegistry = {
  version: string;
  issuedAt: string;
  issuer: string;
  signingKeyId: string;
  ronProviders: Array<{
    id: string;
    name: string;
    status: 'ACTIVE' | 'SUSPENDED';
  }>;
  notaries: Array<{
    id: string;
    name: string;
    commissionState: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
    publicKey: string;
    validFrom: string;
    validTo: string;
  }>;
};
