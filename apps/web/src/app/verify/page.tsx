'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type VerifyResponse = {
  decision: 'ALLOW' | 'FLAG' | 'BLOCK';
  reasons: string[];
  riskScore: number;
  receiptId: string;
  receiptHash: string;
  anchor: {
    status: string;
    txHash?: string;
    chainId?: string;
    anchorId?: string;
  };
};

type BundleInput = {
  bundleId: string;
  transactionType: string;
  ron: {
    provider: string;
    notaryId: string;
    commissionState: string;
    sealPayload: string;
  };
  doc: { docHash: string };
  policy: { profile: string };
  timestamp?: string;
};

export default function VerifyPage() {
  const [payload, setPayload] = useState<BundleInput>({
    bundleId: '',
    transactionType: 'warranty',
    ron: {
      provider: 'RON-1',
      notaryId: 'NOTARY-1',
      commissionState: 'IL',
      sealPayload: ''
    },
    doc: { docHash: '' },
    policy: { profile: 'STANDARD_IL' }
  });
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSample = async () => {
    setError(null);
    const res = await fetch(`${API_BASE}/api/v1/synthetic`);
    const data = (await res.json()) as BundleInput;
    setPayload(data);
  };

  const submit = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verification failed');
      }
      const data = (await res.json()) as VerifyResponse;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const anchor = async () => {
    if (!result) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/anchor/${result.receiptId}`, {
        method: 'POST'
      });
      const data = await res.json();
      setResult({ ...result, anchor: { ...result.anchor, ...data } });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <h2>Verify bundle</h2>
        <p className="muted">Use synthetic data only. No real PII is stored.</p>
        <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
          <button className="button secondary" type="button" onClick={loadSample}>
            Load Sample
          </button>
          <button className="button" type="button" onClick={submit} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify'}
          </button>
        </div>
        <div className="grid">
          <label>
            Bundle ID
            <input
              className="input"
              value={payload.bundleId}
              onChange={(e) => setPayload({ ...payload, bundleId: e.target.value })}
            />
          </label>
          <label>
            Transaction Type
            <input
              className="input"
              value={payload.transactionType}
              onChange={(e) => setPayload({ ...payload, transactionType: e.target.value })}
            />
          </label>
          <label>
            RON Provider
            <input
              className="input"
              value={payload.ron.provider}
              onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, provider: e.target.value } })}
            />
          </label>
          <label>
            Notary ID
            <input
              className="input"
              value={payload.ron.notaryId}
              onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, notaryId: e.target.value } })}
            />
          </label>
          <label>
            Commission State
            <input
              className="input"
              value={payload.ron.commissionState}
              onChange={(e) =>
                setPayload({ ...payload, ron: { ...payload.ron, commissionState: e.target.value } })
              }
            />
          </label>
          <label>
            Seal Payload
            <input
              className="input mono"
              value={payload.ron.sealPayload}
              onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, sealPayload: e.target.value } })}
            />
          </label>
          <label>
            Doc Hash
            <input
              className="input mono"
              value={payload.doc.docHash}
              onChange={(e) => setPayload({ ...payload, doc: { docHash: e.target.value } })}
            />
          </label>
          <label>
            Policy Profile
            <input
              className="input"
              value={payload.policy.profile}
              onChange={(e) => setPayload({ ...payload, policy: { profile: e.target.value } })}
            />
          </label>
        </div>
      </div>

      {error && (
        <div className="card">
          <strong>Error</strong>
          <p className="muted">{error}</p>
        </div>
      )}

      {result && (
        <div className="card">
          <h3>Decision: {result.decision}</h3>
          <p className="muted">Risk Score: {result.riskScore}</p>
          <p>Reasons: {result.reasons.join(', ') || 'None'}</p>
          <p className="mono">Receipt Hash: {result.receiptHash}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="button" type="button" onClick={anchor} disabled={loading}>
              Anchor Receipt
            </button>
            <a className="button secondary" href={`/receipt/${result.receiptId}`}>
              View Receipt
            </a>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Anchor status: {result.anchor.status}
            {result.anchor.txHash ? ` (${result.anchor.txHash})` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
