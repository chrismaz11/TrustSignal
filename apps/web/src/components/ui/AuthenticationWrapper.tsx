'use client';

import React, { useState } from 'react';
import { useOperator } from '../../contexts/OperatorContext';
import { OperatorContext as OperatorContextType } from '../../types';
import { Button } from './Button';
import { Input } from './Input';

interface AuthenticationWrapperProps {
  children: React.ReactNode;
}

export function AuthenticationWrapper({ children }: AuthenticationWrapperProps) {
  const { isAuthenticated, operator, login, logout } = useOperator();
  const [showLogin, setShowLogin] = useState(false);
  const [form, setForm] = useState({
    name: '',
    operatorId: '',
    role: 'notary' as OperatorContextType['role'],
    tenantId: ''
  });
  const [error, setError] = useState<string | null>(null);

  const handleLogin = () => {
    if (!form.name.trim() || !form.operatorId.trim() || !form.tenantId.trim()) {
      setError('All fields are required.');
      return;
    }
    const op: OperatorContextType = {
      name: form.name.trim(),
      operatorId: form.operatorId.trim(),
      role: form.role,
      tenantId: form.tenantId.trim(),
      permissions: ['verify', 'anchor', 'export']
    };
    login(op);
    setShowLogin(false);
    setError(null);
  };

  if (isAuthenticated && operator) {
    return (
      <div className="auth-wrapper">
        <div className="auth-header-bar">
          <span className="auth-operator-name">
            {operator.name}
            <span className="auth-operator-role muted"> · {operator.role.replace('_', ' ')}</span>
          </span>
          <button type="button" className="button secondary" style={{ fontSize: '0.75rem', padding: '4px 12px' }} onClick={logout}>
            Sign out
          </button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="auth-gate">
      {!showLogin ? (
        <div className="card" style={{ maxWidth: 420, margin: '48px auto' }}>
          <h2>Operator Console</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Sign in to access the verification console. Your identity is recorded in all audit logs.
          </p>
          <Button onClick={() => setShowLogin(true)}>Sign In as Operator</Button>
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 420, margin: '48px auto' }}>
          <h2>Identify Yourself</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Your name and ID will be attached to all verification receipts and audit logs.
          </p>
          {error && <p className="text-danger" style={{ marginBottom: 12 }}>{error}</p>}
          <div className="grid">
            <Input
              label="Full Name"
              placeholder="Jane Smith"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Input
              label="Operator ID"
              placeholder="NOTARY-12345"
              value={form.operatorId}
              onChange={(e) => setForm({ ...form, operatorId: e.target.value })}
            />
            <div className="form-group">
              <label className="form-label" htmlFor="auth-role">Role</label>
              <select
                id="auth-role"
                className="select"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as OperatorContextType['role'] })}
              >
                <option value="notary">Notary</option>
                <option value="title_company">Title Company</option>
                <option value="county_recorder">County Recorder</option>
              </select>
            </div>
            <Input
              label="Tenant / Organization ID"
              placeholder="ORG-001"
              value={form.tenantId}
              onChange={(e) => setForm({ ...form, tenantId: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Button onClick={handleLogin}>Continue</Button>
            <Button variant="secondary" onClick={() => { setShowLogin(false); setError(null); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
