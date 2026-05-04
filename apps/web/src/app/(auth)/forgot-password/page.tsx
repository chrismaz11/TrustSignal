'use client';

import { useState } from 'react';
import Link from 'next/link';

import { createClient } from '../../../lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/app/reset-password`
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="page page-center">
      <div className="container container-tight py-4">
        <div className="text-center mb-4">
          <Link href="/" className="navbar-brand navbar-brand-autodark">
            <span style={{ fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
              TrustSignal
            </span>
          </Link>
        </div>

        <div className="card card-md">
          <div className="card-body">
            <h2 className="h2 text-center mb-4">Forgot password</h2>

            {sent ? (
              <div className="alert alert-success">
                If that email is registered, you&apos;ll receive a reset link shortly.
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <p className="text-secondary mb-4">
                  Enter your email address and we&apos;ll send you a password reset link.
                </p>
                <div className="mb-3">
                  <label className="form-label">Email address</label>
                  <input
                    type="email"
                    className="form-control"
                    placeholder="you@company.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-footer">
                  <button
                    type="submit"
                    className="btn btn-primary w-100"
                    disabled={loading}
                  >
                    {loading ? 'Sending…' : 'Send reset link'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div className="text-center text-secondary mt-3">
          <Link href="/app/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
