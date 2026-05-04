'use client';

import { useState } from 'react';
import { generateApiKey, revokeApiKey, type ApiKeyRecord } from './actions';

interface NewKey {
  rawKey: string;
  prefix: string;
  name: string;
  createdAt: string;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKey, setNewKey] = useState<NewKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  async function handleCreate() {
    setError(null);
    setCreating(true);
    try {
      const result = await generateApiKey(newKeyName);
      const record: ApiKeyRecord = {
        id: result.id,
        name: result.name,
        prefix: result.prefix,
        createdAt: result.createdAt,
        lastUsedAt: null,
        revokedAt: null
      };
      setKeys((prev) => [record, ...prev]);
      setNewKey({ rawKey: result.rawKey, prefix: result.prefix, name: result.name, createdAt: result.createdAt });
      setNewKeyName('');
      setShowCreateModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate key.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke key "${name}"? This cannot be undone. Any systems using this key will lose access.`)) return;
    await revokeApiKey(id);
    setKeys((prev) =>
      prev.map((k) => (k.id === id ? { ...k, revokedAt: new Date().toISOString() } : k))
    );
  }

  async function copyKey() {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey.rawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">API Keys</h2>
              <div className="text-muted mt-1">
                Keys are used to authenticate programmatic access to <code>POST /api/v1/verify</code>.
              </div>
            </div>
            <div className="col-auto ms-auto d-print-none">
              <button
                className="btn btn-primary"
                onClick={() => { setShowCreateModal(true); setError(null); }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24"
                  viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5l0 14" /><path d="M5 12l14 0" />
                </svg>
                Create new key
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="container-xl">

          {/* Newly created key — show once */}
          {newKey && (
            <div className="alert alert-success alert-dismissible mb-4" role="alert">
              <div className="d-flex align-items-start">
                <div className="flex-grow-1">
                  <h4 className="alert-title">Key created — copy it now</h4>
                  <p className="text-muted small mb-2">
                    This is the only time the full key will be shown. We store only a hash.
                  </p>
                  <div className="input-group input-group-flat mb-2" style={{ maxWidth: 560 }}>
                    <input
                      type="text"
                      className="form-control"
                      readOnly
                      value={newKey.rawKey}
                      style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}
                    />
                    <span className="input-group-text">
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost-success"
                        onClick={copyKey}
                      >
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    </span>
                  </div>
                  <p className="text-muted small mb-0">Key name: <strong>{newKey.name}</strong></p>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setNewKey(null)}
                />
              </div>
            </div>
          )}

          {/* Security notice */}
          <div className="card mb-4">
            <div className="card-body">
              <div className="row align-items-center">
                <div className="col-auto">
                  <span className="badge bg-blue-lt p-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
                      <path d="M12 11m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
                      <path d="M12 12l0 2.5" />
                    </svg>
                  </span>
                </div>
                <div className="col">
                  <strong>How keys work</strong>
                  <div className="text-muted small">
                    Keys are prefixed <code>ts_live_</code> and hashed with SHA-256 before storage.
                    The raw key is shown once at creation. Rotate keys immediately if compromised.
                    Each key is scoped to your tenant — it cannot access other tenants&apos; data.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Keys table */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Active keys</h3>
            </div>
            {keys.length === 0 ? (
              <div className="card-body text-center text-muted py-5">
                No API keys yet. Create one to get started.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Key prefix</th>
                      <th>Created</th>
                      <th>Last used</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((key) => (
                      <tr key={key.id}>
                        <td>{key.name}</td>
                        <td>
                          <code className="text-muted">{key.prefix}…</code>
                        </td>
                        <td className="text-muted">
                          {new Date(key.createdAt).toLocaleDateString()}
                        </td>
                        <td className="text-muted">
                          {key.lastUsedAt
                            ? new Date(key.lastUsedAt).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td>
                          {key.revokedAt ? (
                            <span className="badge bg-red-lt">Revoked</span>
                          ) : (
                            <span className="badge bg-green-lt">Active</span>
                          )}
                        </td>
                        <td className="text-end">
                          {!key.revokedAt && (
                            <button
                              className="btn btn-sm btn-ghost-danger"
                              onClick={() => handleRevoke(key.id, key.name)}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create key modal */}
      {showCreateModal && (
        <div className="modal modal-blur fade show d-block" tabIndex={-1} role="dialog"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-sm modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">New API key</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCreateModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Key name</label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Production, CI pipeline"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    autoFocus
                  />
                  <div className="form-hint">Give it a descriptive name so you know what uses it.</div>
                </div>
                {error && (
                  <div className="alert alert-danger">{error}</div>
                )}
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn me-auto"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCreate}
                  disabled={creating || !newKeyName.trim()}
                >
                  {creating ? 'Generating…' : 'Generate key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
