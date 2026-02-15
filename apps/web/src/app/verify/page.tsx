'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

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
  property: {
    parcelId: string;
    county: string;
    state: string;
  };
  ocrData?: {
    grantorName?: string;
  };
  policy: { profile: string };
  timestamp?: string;
};

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [payload, setPayload] = useState<BundleInput>({
    bundleId: 'BUNDLE-' + Date.now(),
    transactionType: 'warranty',
    ron: {
      provider: 'RON-1',
      notaryId: 'NOTARY-1',
      commissionState: 'IL',
      sealPayload: 'example-seal-payload'
    },
    doc: { docHash: '' },
    property: {
      parcelId: '',
      county: 'Cook',
      state: 'IL'
    },
    ocrData: {
      grantorName: ''
    },
    policy: { profile: 'STANDARD_IL' }
  });

  useEffect(() => {
    const hash = searchParams?.get('hash');
    const pin = searchParams?.get('pin');
    const grantor = searchParams?.get('grantor');

    if (hash || pin || grantor) {
      setPayload(prev => ({
        ...prev,
        doc: { docHash: hash || prev.doc.docHash },
        property: {
          ...prev.property,
          parcelId: pin || prev.property.parcelId
        },
        ocrData: {
          ...prev.ocrData,
          grantorName: grantor || prev.ocrData?.grantorName
        }
      }));
    }
  }, [searchParams]);

  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'operator' | 'verifier'>('operator');

  // Verifier State
  const [verifierInput, setVerifierInput] = useState('');
  const [verifierResult, setVerifierResult] = useState<any | null>(null);

  const verifyReceipt = async () => {
    setLoading(true);
    setError(null);
    setVerifierResult(null);
    try {
      // 1. Get Receipt Details
      const resDetails = await fetch(`${API_BASE}/api/v1/receipt/${verifierInput}`);
      if (!resDetails.ok) throw new Error('Receipt not found');
      const details = await resDetails.json();

      // 2. Verify Cryptographic Status
      const resVerify = await fetch(`${API_BASE}/api/v1/receipt/${verifierInput}/verify`, { method: 'POST' });
      if (resVerify.status === 409) {
          throw new Error('Receipt has been REVOKED');
      }
      if (!resVerify.ok) throw new Error('Verification failed');
      const verifyData = await resVerify.json();

      setVerifierResult({ details, verifyData });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

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
        <div style={{ display: 'flex', gap: 16, borderBottom: '1px solid #333', paddingBottom: 16, marginBottom: 16 }}>
          <button
            className={`button ${viewMode === 'operator' ? '' : 'secondary'}`}
            onClick={() => setViewMode('operator')}
          >
            Closing Operator
          </button>
          <button
            className={`button ${viewMode === 'verifier' ? '' : 'secondary'}`}
            onClick={() => setViewMode('verifier')}
          >
            Verifier / Recorder
          </button>
        </div>

        {viewMode === 'operator' ? (
          <>
            <h2>Signed Attestation</h2>
            <p className="muted">Use synthetic data only. No real PII is stored.</p>
            <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
              <button className="button secondary" type="button" onClick={loadSample}>
                Load Sample
              </button>
              <button className="button" type="button" onClick={submit} disabled={loading}>
                {loading ? 'Verifying…' : 'Submit Attestation'}
              </button>
            </div>
            
            <div className="grid">
              {/* Existing Form Inputs */}
              <label>
                Bundle ID
                <input className="input" value={payload.bundleId} onChange={(e) => setPayload({ ...payload, bundleId: e.target.value })} />
              </label>
              <label>
                Transaction Type
                <input className="input" value={payload.transactionType} onChange={(e) => setPayload({ ...payload, transactionType: e.target.value })} />
              </label>
              <label>
                RON Provider
                <input className="input" value={payload.ron.provider} onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, provider: e.target.value } })} />
              </label>
              <label>
                Notary ID
                <input className="input" value={payload.ron.notaryId} onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, notaryId: e.target.value } })} />
              </label>
              <label>
                Commission State
                <input className="input" value={payload.ron.commissionState} onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, commissionState: e.target.value } })} />
              </label>
              <label>
                Seal Payload
                <input className="input mono" value={payload.ron.sealPayload} onChange={(e) => setPayload({ ...payload, ron: { ...payload.ron, sealPayload: e.target.value } })} />
              </label>
              <label>
                Doc Hash
                <input className="input mono" value={payload.doc.docHash} onChange={(e) => setPayload({ ...payload, doc: { docHash: e.target.value } })} />
              </label>
              <label>
                Parcel ID (PIN)
                <input className="input mono" value={payload.property?.parcelId || ''} onChange={(e) => setPayload({ ...payload, property: { ...payload.property, parcelId: e.target.value } })} />
              </label>
              <label>
                Grantor Name
                <input className="input" value={payload.ocrData?.grantorName || ''} onChange={(e) => setPayload({ ...payload, ocrData: { ...payload.ocrData, grantorName: e.target.value } })} />
              </label>
              <label>
                Policy Profile
                <input className="input" value={payload.policy.profile} onChange={(e) => setPayload({ ...payload, policy: { profile: e.target.value } })} />
              </label>
            </div>
          </>
        ) : (
          <>
            <h2>Recall Receipt</h2>
            <p className="muted">Enter Receipt ID to verify status.</p>
            <div style={{ display: 'flex', gap: 12, margin: '16px 0' }}>
               <input 
                  className="input" 
                  placeholder="Receipt ID" 
                  value={verifierInput} 
                  onChange={(e) => setVerifierInput(e.target.value)} 
               />
               <button className="button" onClick={verifyReceipt} disabled={loading}>
                 Check Status
               </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'red' }}>
          <strong>Error</strong>
          <p className="muted">{error}</p>
        </div>
      )}

      {viewMode === 'operator' && result && (
        <div className="card">
          <h3>Verification Status: {result.decision}</h3>
          <p className="muted">Risk Score: {result.riskScore}</p>
          <p>Reasons: {result.reasons.join(', ') || 'None'}</p>
          <p className="mono">Receipt Hash: {result.receiptHash}</p>
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <button className="button" type="button" onClick={anchor} disabled={loading}>
              Anchor Receipt
            </button>
            <a className="button secondary" href={`${API_BASE}/api/v1/receipt/${result.receiptId}/pdf`} target="_blank" rel="noopener noreferrer">
              Download Receipt
            </a>
          </div>
          <p className="muted" style={{ marginTop: 12 }}>
            Anchor status: {result.anchor.status}
            {result.anchor.txHash ? ` (${result.anchor.txHash})` : ''}
          </p>
        </div>
      )}

      {viewMode === 'verifier' && verifierResult && (
         <div className="card">
            <h3>Verification Status: {verifierResult.verifyData.verified ? 'VALID' : 'INVALID'}</h3>
            {verifierResult.verifyData.revoked && <p style={{ color: 'red', fontWeight: 'bold' }}>REVOKED</p>}
            <p className="muted">Receipt ID: {verifierResult.details.receiptId}</p>
            <p className="muted">Decision: {verifierResult.details.decision}</p>
            <p className="mono">Hash: {verifierResult.details.receiptHash}</p>
            
            <div style={{ marginTop: 16 }}>
               <a className="button" href={`${API_BASE}/api/v1/receipt/${verifierResult.details.receiptId}/pdf`} target="_blank" rel="noopener noreferrer">
                  Download Receipt
               </a>
            </div>
         </div>
      )}
    </div>
  );
}
