// Core Data Models

export interface OperatorContext {
  operatorId: string;
  name: string;
  role: 'notary' | 'title_company' | 'county_recorder';
  tenantId: string;
  permissions: string[];
}

export interface OperatorAttestation {
  operatorId: string;
  timestamp: string;
  attestationText: string;
  confirmed: boolean;
}

export interface RONBundle {
  bundleId: string;
  transactionType: TransactionType;
  ron: {
    provider: RONProvider;
    notaryId: string;
    commissionState: USState;
    sealPayload: string;
  };
  doc: { docHash: string };
  policy: { profile: PolicyProfile };
}

export interface VerificationResult {
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  reasons: string[];
  riskScore: number;
  receiptId: string;
  receiptHash: string;
  anchor: AnchorStatus;
  operator: OperatorContext;
  timestamp: string;
  attestation: OperatorAttestation;
}

export interface AnchorStatus {
  status: string;
  txHash?: string;
  chainId?: string;
  anchorId?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  operator: OperatorContext;
  action: 'verification' | 'anchor' | 'export';
  bundleId: string;
  decision?: 'ALLOW' | 'FLAG' | 'BLOCK';
  receiptId?: string;
  details: Record<string, any>;
}

// Controlled Input Types
export type TransactionType = 
  | 'warranty_deed'
  | 'quitclaim_deed'
  | 'trust_deed'
  | 'mortgage'
  | 'reconveyance'
  | 'assignment';

export type RONProvider = 
  | 'RON-1'
  | 'DocuSign'
  | 'NotaryCam'
  | 'Pavaso'
  | 'SIGNiX';

export type USState = 
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'FL' | 'GA'
  | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA' | 'ME' | 'MD'
  | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV' | 'NH' | 'NJ'
  | 'NM' | 'NY' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR' | 'PA' | 'RI' | 'SC'
  | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

export type PolicyProfile = 
  | 'STANDARD_CA'
  | 'STANDARD_TX'
  | 'STANDARD_FL'
  | 'ENHANCED_FRAUD_DETECTION'
  | 'COUNTY_SPECIFIC'
  | 'TITLE_COMPANY_PREMIUM';

export interface DropdownOption<T> {
  value: T;
  label: string;
  description?: string;
}