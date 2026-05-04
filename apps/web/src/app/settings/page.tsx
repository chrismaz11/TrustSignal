'use client';

import { useState } from 'react';

const COMPLIANCE_PROFILES = [
  { id: 'soc2', label: 'SOC 2 Type II', description: 'AICPA trust service criteria — security, availability, processing integrity' },
  { id: 'ron_standard', label: 'RON Standard', description: 'Remote Online Notarization — MISMO/MBA baseline requirements' },
  { id: 'county_recording', label: 'County Recording', description: 'URPERA-aligned county recorder verification profile' },
  { id: 'title_insurance', label: 'Title Insurance', description: 'ALTA/NSPS title commitment verification requirements' },
  { id: 'enhanced_fraud', label: 'Enhanced Fraud Detection', description: 'ZKML-scored fraud screening with elevated risk thresholds' },
];

const DEFAULT_SAMPLE = {
  transactionType: 'warranty_deed',
  ronProvider: 'RON-1',
  commissionState: 'IL',
  county: 'Cook',
  policyProfile: 'STANDARD_CA',
};

export default function SettingsPage() {
  const [enabledProfiles, setEnabledProfiles] = useState<Set<string>>(
    new Set(['ron_standard'])
  );
  const [sample, setSample] = useState(DEFAULT_SAMPLE);
  const [saved, setSaved] = useState(false);

  const toggleProfile = (id: string) => {
    setEnabledProfiles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    // In production this would persist to tenant config via API
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 0' }}>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 4 }}>Settings</h1>
      <p className="muted" style={{ marginBottom: 32 }}>
        Configure compliance profiles and default verification values for your organization.
      </p>

      {/* Compliance profiles */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Compliance Checks</h2>
        <p className="muted" style={{ fontSize: '0.875rem', marginBottom: 20 }}>
          Select which compliance frameworks are active for this tenant. Enabled profiles run on every verification.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {COMPLIANCE_PROFILES.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={enabledProfiles.has(p.id)}
                onChange={() => toggleProfile(p.id)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <span>
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{p.label}</span>
                <br />
                <span className="muted" style={{ fontSize: '0.8125rem' }}>{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Default verification values */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>Default Verification Values</h2>
        <p className="muted" style={{ fontSize: '0.875rem', marginBottom: 20 }}>
          Pre-fill the console form with your organization's most common values. Operators can still override per-submission.
        </p>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="form-group">
            <label className="form-label">Default Transaction Type</label>
            <input className="input" value={sample.transactionType}
              onChange={(e) => setSample({ ...sample, transactionType: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Default RON Provider</label>
            <input className="input" value={sample.ronProvider}
              onChange={(e) => setSample({ ...sample, ronProvider: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Default Commission State</label>
            <input className="input" value={sample.commissionState}
              onChange={(e) => setSample({ ...sample, commissionState: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Default County</label>
            <input className="input" value={sample.county}
              onChange={(e) => setSample({ ...sample, county: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Default Policy Profile</label>
            <input className="input" value={sample.policyProfile}
              onChange={(e) => setSample({ ...sample, policyProfile: e.target.value })} />
          </div>
        </div>
      </div>

      {/* API access */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 4 }}>API Access</h2>
        <p className="muted" style={{ fontSize: '0.875rem', marginBottom: 16 }}>
          Your API key is used by automated systems to call <code style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>POST /api/v1/verify</code> directly. Keep it secret.
        </p>
        <div className="copyable-row" style={{ maxWidth: 480 }}>
          <span className="copyable-value mono">{'••••••••••••••••••••••••••••••'}</span>
          <button type="button" className="copyable-btn" disabled>Reveal key in production</button>
        </div>
        <p className="muted" style={{ fontSize: '0.75rem', marginTop: 8 }}>
          API key management requires production deployment with KMS. Not available in local dev.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <button className="button" type="button" onClick={handleSave}>Save Settings</button>
        {saved && <span className="muted" style={{ fontSize: '0.875rem' }}>Saved.</span>}
      </div>
    </div>
  );
}
