'use client';

import { use, useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

type ReceiptDetail = {
  receipt: {
    receiptId: string;
    createdAt: string;
    decision: string;
    riskScore: number;
    reasons: string[];
    receiptHash: string;
    inputsCommitment: string;
    policyProfile: string;
    checks: Array<{ checkId: string; status: string; details?: string }>;
  };
  canonicalReceipt: string;
  pdfUrl: string;
  anchor: {
    status: string;
    txHash?: string;
    chainId?: string;
    anchorId?: string;
  };
};

export default function ReceiptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [verifyResult, setVerifyResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch(`${API_BASE}/api/v1/receipt/${id}`);
      const data = (await res.json()) as ReceiptDetail;
      setDetail(data);
    };
    load();
  }, [id]);

  const verifyIntegrity = async () => {
    const res = await fetch(`${API_BASE}/api/v1/receipt/${id}/verify`, { method: 'POST' });
    const data = await res.json();
    setVerifyResult(data.verified ? 'Integrity verified' : 'Mismatch detected');
  };

  if (!detail) {
    return (
      <div className="card">
        <p className="muted">Loading receipt...</p>
      </div>
    );
  }

  return (
    <div className="grid">
      <div className="card">
        <h2>Receipt {detail.receipt.receiptId}</h2>
        <p className="muted">Created {new Date(detail.receipt.createdAt).toLocaleString()}</p>
        <p>Decision: {detail.receipt.decision}</p>
        <p>Risk Score: {detail.receipt.riskScore}</p>
        <p>Policy Profile: {detail.receipt.policyProfile}</p>
        <p>Reasons: {detail.receipt.reasons.join(', ') || 'None'}</p>
        <p className="mono">Receipt Hash: {detail.receipt.receiptHash}</p>
        <p className="mono">Inputs Commitment: {detail.receipt.inputsCommitment}</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
          <a className="button" href={`${API_BASE}${detail.pdfUrl}`}>
            Download PDF
          </a>
          <button className="button secondary" type="button" onClick={verifyIntegrity}>
            Verify Integrity
          </button>
        </div>
        {verifyResult && <p className="muted">{verifyResult}</p>}
      </div>

      <div className="card">
        <h3>Checks</h3>
        <ul>
          {detail.receipt.checks.map((check) => (
            <li key={check.checkId}>
              {check.checkId}: {check.status} {check.details ? `(${check.details})` : ''}
            </li>
          ))}
        </ul>
        <h3>Anchor</h3>
        <p>Status: {detail.anchor.status}</p>
        {detail.anchor.txHash && <p className="mono">Tx: {detail.anchor.txHash}</p>}
        {detail.anchor.anchorId && <p className="mono">Anchor ID: {detail.anchor.anchorId}</p>}
      </div>

      <div className="card">
        <h3>Canonical Receipt</h3>
        <pre className="mono">{detail.canonicalReceipt}</pre>
      </div>
    </div>
  );
}
