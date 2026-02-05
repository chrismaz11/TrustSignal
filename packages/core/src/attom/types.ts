export type DeedParsed = {
  jurisdiction: { state: 'IL'; county: 'Cook' | string };
  pin: string | null;
  address: { line1: string; city: string; state: string; zip?: string | null } | null;
  legalDescriptionText: string | null;
  grantors: string[];
  grantees: string[];
  executionDate: string | null;
  recording: { docNumber: string | null; recordingDate: string | null };
  notary: { name?: string; commissionExpiration?: string | null; state?: string } | null;
};

export type AttomProperty = {
  apn?: string | null;
  altId?: string | null;
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  };
  location?: {
    lat?: number | null;
    lon?: number | null;
  };
  lot?: {
    lot?: string | null;
    block?: string | null;
    tract?: string | null;
    subdivision?: string | null;
  };
  owners?: string[]; // raw owners should not be persisted; use for comparison only
  assessment?: Record<string, unknown>;
};

export type AttomLookupResult = {
  property: AttomProperty;
  endpoint: 'parcel' | 'address';
  requestId?: string;
  raw?: unknown;
};

export type ReportCheck = {
  id: string;
  status: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
  message: string;
  deedValue?: string | null;
  attomValue?: string | null;
  evidence?: Record<string, unknown>;
};

export type VerificationReport = {
  summary: 'PASS' | 'WARN' | 'FAIL' | 'SKIP';
  checks: ReportCheck[];
  evidence: {
    attomRequestId?: string;
    endpointUsed?: 'parcel' | 'address';
    matchConfidence: number;
    timestamp: string;
    reason?: string;
    canonicalHash: string;
  };
};

export interface AttomClient {
  getByParcel(pin: string): Promise<AttomLookupResult[]>;
  getByAddress(address: NonNullable<DeedParsed['address']>): Promise<AttomLookupResult[]>;
}
