'use client';

import React, { useState } from 'react';
import { DecisionIndicator } from './ui/DecisionIndicator';
import { CopyableField } from './ui/CopyableField';
import { Button } from './ui/Button';
import { VerificationResult } from '../types';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

interface VerificationPanelProps {
  result: VerificationResult | null;
  loading: boolean;
  error: string | null;
}

export function VerificationPanel({ result, loading, error }: VerificationPanelProps) {
  const [anchorStatus, setAnchorStatus] = useState<string | null>(null);
  const [anchoring, setAnchoring] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const handleAnchor = async () => {
    if (!result) return;
    setAnchoring(true);
    setAnchorError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/anchor/${result.receiptId}`, {
        method: 'POST'
      });
      const data = await res.json();
      setAnchorStatus(data.status ?? 'anchored');
    } catch {
      setAnchorError('Anchor request failed');
    } finally {
      setAnchoring(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${result.receiptId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="console-panel verification-panel" aria-label="Verification Results">
      <div className="panel-header">
        <h2 className="panel-title">Verification Panel</h2>
        <p className="panel-subtitle muted">Results and receipt details</p>
      </div>

      <div className="panel-body">
        {!result && !loading && !error && (
          <div className="panel-empty">
            <p className="muted">Submit a verification request to see results here.</p>
          </div>
        )}

        {loading && (
          <div className="panel-empty">
            <p className="muted">Verifying…</p>
          </div>
        )}

        {error && !loading && (
          <div className="card card-danger">
            <strong>Verification Error</strong>
            <p className="muted" style={{ marginTop: 4 }}>{error}</p>
          </div>
        )}

        {result && !loading && (
          <>
            <DecisionIndicator
              decision={result.decision}
              riskScore={result.riskScore}
              reasons={result.reasons}
            />

            <div className="receipt-details">
              <h3 className="form-section-title">Receipt</h3>
              <div className="receipt-fields">
                <CopyableField label="Receipt ID" value={result.receiptId} />
                <CopyableField label="Receipt Hash" value={result.receiptHash} truncate />
              </div>
            </div>

            {result.attestation && (
              <div className="attestation-summary">
                <h3 className="form-section-title">Attestation</h3>
                <p className="muted">
                  Attested by <strong>{result.operator?.name ?? result.attestation.operatorId}</strong>{' '}
                  at {new Date(result.attestation.timestamp).toLocaleString()}
                </p>
                {result.attestation.confirmed && (
                  <span className="badge text-success">Confirmed</span>
                )}
              </div>
            )}

            <div className="anchor-section">
              <h3 className="form-section-title">Blockchain Anchor</h3>
              <p className="muted">
                Status: <strong>{anchorStatus ?? result.anchor?.status ?? 'not anchored'}</strong>
                {result.anchor?.txHash ? ` · ${result.anchor.txHash}` : ''}
              </p>
              {anchorError && <p className="text-danger">{anchorError}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  type="button"
                  onClick={handleAnchor}
                  loading={anchoring}
                  disabled={anchoring}
                >
                  Anchor Receipt
                </Button>
                <a className="button secondary" href={`/receipt/${result.receiptId}`} style={{ fontSize: '0.8125rem' }}>
                  View Receipt
                </a>
                <Button variant="secondary" size="sm" type="button" onClick={handleDownload}>
                  Download JSON
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
