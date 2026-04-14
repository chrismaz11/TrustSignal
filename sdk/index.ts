// Canonical verify payload. The full schema is defined in apps/api — this captures
// the required top-level shape. Extend as needed for optional fields.
export interface VerifyInput {
  doc: {
    pdfBase64?: string;
    [key: string]: unknown;
  };
  ron: {
    commissionState?: string;
    [key: string]: unknown;
  };
  policy: {
    profile: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export type RiskBand = 'LOW' | 'MEDIUM' | 'HIGH';
export type ExternalReceiptStatus = 'clean' | 'failure' | 'revoked' | 'compliance_gap';

export interface ReceiptAnchor {
  status: string;
  backend: string;
  anchorId?: string;
  txHash?: string;
  chainId?: string;
  anchoredAt?: string;
  subjectDigest?: string;
  subjectVersion?: string;
}

export interface FraudRisk {
  score: number;
  band: RiskBand;
  signals: unknown[];
}

// Shape returned by POST /api/v1/verify and GET /api/v1/receipt/:receiptId
export interface VerifyResponse {
  receiptVersion: string;
  status: ExternalReceiptStatus;
  decision: string;
  reasons: string[];
  receiptId: string;
  receiptHash: string;
  receiptSignature?: {
    signature: string;
    alg: 'EdDSA';
    kid: string;
  };
  proofVerified?: boolean;
  anchor: ReceiptAnchor;
  fraudRisk: FraudRisk;
  zkpAttestation?: unknown;
  revocation: {
    status: 'REVOKED' | 'ACTIVE';
  };
}

// Shape returned by POST /api/v1/receipt/:receiptId/revoke
export interface RevokeResponse {
  status: 'REVOKED';
  receiptStatus: 'revoked';
  result: 'REVOKED' | 'ALREADY_REVOKED';
  issuerId?: string;
}

// Shape returned by POST /api/v1/receipt/:receiptId/verify
export interface ReceiptVerifyResponse {
  verified: boolean;
  integrityVerified: boolean;
  signatureVerified: boolean;
  signatureStatus: string;
  signatureReason?: string;
  proofVerified?: boolean;
  recomputedHash: string;
  storedHash: string;
  inputsCommitment?: string;
  receiptSignature: { alg: string; kid: string } | null;
  revoked: boolean;
}

// Revoke requires a signed header set from an authorized issuer.
// See security.ts:verifyRevocationHeaders for the signing protocol.
export interface RevocationHeaders {
  issuerId: string;
  signature: string;
  timestamp: string;
}

export interface SDKOptions {
  baseUrl: string;
  apiKey: string;
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

export class TrustSignalSDK {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: SDKOptions) {
    this.baseUrl = trimTrailingSlashes(options.baseUrl);
    this.apiKey = options.apiKey;
  }

  async verify(input: VerifyInput): Promise<VerifyResponse> {
    return this.request<VerifyResponse>('/api/v1/verify', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  }

  async receipt(receiptId: string): Promise<VerifyResponse> {
    return this.request<VerifyResponse>(
      `/api/v1/receipt/${encodeURIComponent(receiptId)}`,
      { method: 'GET' }
    );
  }

  async verifyReceipt(receiptId: string): Promise<ReceiptVerifyResponse> {
    return this.request<ReceiptVerifyResponse>(
      `/api/v1/receipt/${encodeURIComponent(receiptId)}/verify`,
      { method: 'POST' }
    );
  }

  // Revoke requires authorized issuer headers — no body accepted by the endpoint.
  async revoke(receiptId: string, headers: RevocationHeaders): Promise<RevokeResponse> {
    return this.request<RevokeResponse>(
      `/api/v1/receipt/${encodeURIComponent(receiptId)}/revoke`,
      {
        method: 'POST',
        headers: {
          'x-issuer-id': headers.issuerId,
          'x-issuer-signature': headers.signature,
          'x-signature-timestamp': headers.timestamp
        }
      }
    );
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers ?? {})
      }
    });

    if (!response.ok) {
      let payload: ErrorPayload | null = null;
      try {
        payload = (await response.json()) as ErrorPayload;
      } catch {
        payload = null;
      }

      const message =
        payload?.message ?? payload?.error ?? `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return (await response.json()) as T;
  }
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  return value.slice(0, end);
}
