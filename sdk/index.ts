export interface BundleInput {
  deed_hash: string;
  text_length: number;
  num_signatures: number;
  notary_present: boolean;
  days_since_notarized: number;
  amount: number;
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

export interface RevokeResult {
  revoked: boolean;
  tx_hash: string;
  timestamp: string;
}

interface SDKOptions {
  baseUrl: string;
  apiKey: string;
}

interface VerifyResponse extends CombinedResult {
  record_id: string;
}

interface ErrorPayload {
  error?: string;
  message?: string;
}

export class TrustSignalSDK {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(options: SDKOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.apiKey = options.apiKey;
  }

  async verify(bundle: BundleInput): Promise<CombinedResult> {
    const response = await this.request<VerifyResponse>('/v1/verify-bundle', {
      method: 'POST',
      body: JSON.stringify(bundle)
    });

    return {
      non_mem_ok: response.non_mem_ok,
      revocation_ok: response.revocation_ok,
      zkml_ok: response.zkml_ok,
      fraud_score: response.fraud_score,
      proof_gen_ms: response.proof_gen_ms,
      timestamp: response.timestamp,
      bundle_hash: response.bundle_hash
    };
  }

  async revoke(bundleHash: string, reason: string): Promise<RevokeResult> {
    return this.request<RevokeResult>('/v1/revoke', {
      method: 'POST',
      body: JSON.stringify({
        bundle_hash: bundleHash,
        reason
      })
    });
  }

  async status(bundleId: string): Promise<CombinedResult> {
    return this.request<CombinedResult>(`/v1/status/${encodeURIComponent(bundleId)}`, {
      method: 'GET'
    });
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
