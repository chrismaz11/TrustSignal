'use client';

import React, { useState } from 'react';
import { Select } from './ui/Select';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { OperatorAttestation } from './ui/OperatorAttestation';
import {
  TRANSACTION_TYPE_OPTIONS,
  RON_PROVIDER_OPTIONS,
  US_STATE_OPTIONS,
  POLICY_PROFILE_OPTIONS
} from '../constants/dropdownOptions';
import { TransactionType, RONProvider, USState, PolicyProfile, VerificationResult } from '../types';
import { useOperator } from '../contexts/OperatorContext';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:3001';

interface ReceiptGeneratorPanelProps {
  onResult: (result: VerificationResult) => void;
  onError: (msg: string) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

interface BundleFormState {
  bundleId: string;
  transactionType: TransactionType;
  ronProvider: RONProvider;
  notaryId: string;
  commissionState: USState;
  sealPayload: string;
  docHash: string;
  parcelId: string;
  county: string;
  grantorName: string;
  policyProfile: PolicyProfile;
}

export function ReceiptGeneratorPanel({ onResult, onError, loading, setLoading }: ReceiptGeneratorPanelProps) {
  const { operator } = useOperator();
  const [attested, setAttested] = useState(false);
  const [form, setForm] = useState<BundleFormState>({
    bundleId: `BUNDLE-${Date.now()}`,
    transactionType: 'warranty_deed',
    ronProvider: 'RON-1',
    notaryId: '',
    commissionState: 'IL',
    sealPayload: '',
    docHash: '',
    parcelId: '',
    county: '',
    grantorName: '',
    policyProfile: 'STANDARD_CA'
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadSample = async () => {
    onError('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/synthetic`);
      const data = await res.json();
      setForm(prev => ({
        ...prev,
        bundleId: data.bundleId || prev.bundleId,
        transactionType: (data.transactionType as TransactionType) || prev.transactionType,
        ronProvider: (data.ron?.provider as RONProvider) || prev.ronProvider,
        notaryId: data.ron?.notaryId || prev.notaryId,
        commissionState: (data.ron?.commissionState as USState) || prev.commissionState,
        sealPayload: data.ron?.sealPayload || prev.sealPayload,
        docHash: data.doc?.docHash || prev.docHash,
        parcelId: data.property?.parcelId || prev.parcelId,
        county: data.property?.county || prev.county,
        grantorName: data.ocrData?.grantorName || prev.grantorName,
        policyProfile: (data.policy?.profile as PolicyProfile) || prev.policyProfile
      }));
    } catch {
      onError('Failed to load sample data');
    }
  };

  const validate = (): string | null => {
    if (!form.bundleId.trim()) return 'Bundle ID is required.';
    if (!form.notaryId.trim()) return 'Notary ID is required.';
    if (!form.docHash.trim()) return 'Document hash is required.';
    if (!attested) return 'Operator attestation is required before submitting.';
    return null;
  };

  const submit = async () => {
    const err = validate();
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setLoading(true);
    onError('');
    try {
      const body = {
        bundleId: form.bundleId,
        transactionType: form.transactionType,
        ron: {
          provider: form.ronProvider,
          notaryId: form.notaryId,
          commissionState: form.commissionState,
          sealPayload: form.sealPayload
        },
        doc: { docHash: form.docHash },
        property: {
          parcelId: form.parcelId,
          county: form.county,
          state: form.commissionState
        },
        ocrData: { grantorName: form.grantorName },
        policy: { profile: form.policyProfile },
        operator: operator ? {
          operatorId: operator.operatorId,
          name: operator.name,
          role: operator.role,
          tenantId: operator.tenantId
        } : undefined,
        attestation: attested ? {
          operatorId: operator?.operatorId ?? 'unknown',
          timestamp: new Date().toISOString(),
          attestationText: 'Operator-confirmed verification',
          confirmed: true
        } : undefined,
        timestamp: new Date().toISOString()
      };
      const res = await fetch(`${API_BASE}/api/v1/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Verification failed');
      }
      const data = await res.json();
      onResult(data as VerificationResult);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="console-panel receipt-generator-panel" aria-label="Receipt Generator">
      <div className="panel-header">
        <h2 className="panel-title">Receipt Generator</h2>
        <p className="panel-subtitle muted">Initiate RON bundle verification</p>
      </div>

      <div className="panel-body">
        <div className="panel-actions">
          <Button variant="secondary" size="sm" type="button" onClick={loadSample} disabled={loading}>
            Load Sample
          </Button>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Bundle Details</h3>
          <div className="form-grid">
            <Input
              label="Bundle ID"
              value={form.bundleId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, bundleId: e.target.value })}
            />
            <Select
              label="Transaction Type"
              options={TRANSACTION_TYPE_OPTIONS}
              value={form.transactionType}
              onChange={(v: TransactionType) => setForm({ ...form, transactionType: v })}
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">RON Details</h3>
          <div className="form-grid">
            <Select
              label="RON Provider"
              options={RON_PROVIDER_OPTIONS}
              value={form.ronProvider}
              onChange={(v: RONProvider) => setForm({ ...form, ronProvider: v })}
            />
            <Input
              label="Notary ID"
              placeholder="NOTARY-12345"
              value={form.notaryId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, notaryId: e.target.value })}
            />
            <Select
              label="Commission State"
              options={US_STATE_OPTIONS}
              value={form.commissionState}
              onChange={(v: USState) => setForm({ ...form, commissionState: v })}
            />
            <Input
              label="Seal Payload"
              placeholder="base64-encoded seal"
              className="mono"
              value={form.sealPayload}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, sealPayload: e.target.value })}
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Document</h3>
          <div className="form-grid">
            <Input
              label="Document Hash"
              placeholder="sha256:..."
              className="mono"
              value={form.docHash}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, docHash: e.target.value })}
            />
            <Input
              label="Parcel ID (PIN)"
              placeholder="12-34-567-890"
              className="mono"
              value={form.parcelId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, parcelId: e.target.value })}
            />
            <Input
              label="County"
              placeholder="Cook"
              value={form.county}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, county: e.target.value })}
            />
            <Input
              label="Grantor Name"
              placeholder="Full legal name"
              value={form.grantorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, grantorName: e.target.value })}
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="form-section-title">Policy</h3>
          <Select
            label="Policy Profile"
            options={POLICY_PROFILE_OPTIONS}
            value={form.policyProfile}
            onChange={(v: PolicyProfile) => setForm({ ...form, policyProfile: v })}
          />
        </div>

        <div className="form-section">
          <OperatorAttestation
            checked={attested}
            onChange={setAttested}
            operatorName={operator?.name}
            disabled={loading}
          />
        </div>

        {validationError && (
          <p className="text-danger" style={{ marginBottom: 8 }}>{validationError}</p>
        )}

        <Button
          type="button"
          onClick={submit}
          disabled={loading || !attested}
          loading={loading}
          style={{ width: '100%' }}
        >
          {loading ? 'Verifying…' : 'Submit Verification'}
        </Button>
      </div>
    </section>
  );
}
