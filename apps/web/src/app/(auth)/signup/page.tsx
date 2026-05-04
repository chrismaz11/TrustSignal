'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { createClient } from '../../../lib/supabase/client';

const COMPANY_TYPES = [
  { value: '', label: 'Select company type…' },
  { value: 'title_company', label: 'Title Company' },
  { value: 'notary', label: 'Notary / RON Provider' },
  { value: 'county_recorder', label: 'County Recorder' },
  { value: 'lender', label: 'Mortgage Lender' },
  { value: 'law_firm', label: 'Law Firm' },
  { value: 'other', label: 'Other' }
];

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    companyName: '',
    companyType: '',
    fullName: ''
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.companyType) {
      setError('Please select a company type.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName,
            company_name: form.companyName,
            company_type: form.companyType
          }
        }
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push('/app/onboarding');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app/onboarding` }
    });
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
            <h2 className="h2 text-center mb-4">Create your account</h2>

            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
              <div className="mb-3">
                <label className="form-label">Full name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Jane Smith"
                  required
                  value={form.fullName}
                  onChange={(e) => update('fullName', e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Company name</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Acme Title Co."
                  required
                  value={form.companyName}
                  onChange={(e) => update('companyName', e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Company type</label>
                <select
                  className="form-select"
                  required
                  value={form.companyType}
                  onChange={(e) => update('companyType', e.target.value)}
                >
                  {COMPANY_TYPES.map((opt) => (
                    <option key={opt.value} value={opt.value} disabled={opt.value === ''}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Work email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="you@company.com"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="At least 12 characters"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                />
              </div>

              {error && (
                <div className="alert alert-danger mb-3" role="alert">
                  {error}
                </div>
              )}

              <div className="mb-3">
                <label className="form-check">
                  <input type="checkbox" className="form-check-input" required />
                  <span className="form-check-label">
                    I agree to the{' '}
                    <Link href="/terms-of-service" target="_blank">Terms of Service</Link>{' '}
                    and{' '}
                    <Link href="/privacy-policy" target="_blank">Privacy Policy</Link>
                  </span>
                </label>
              </div>

              <div className="form-footer">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? 'Creating account…' : 'Create account'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="card card-md mt-3">
          <div className="card-body">
            <div className="row">
              <div className="col">
                <button
                  type="button"
                  className="btn w-100"
                  onClick={() => handleOAuth('google')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.945 11a9 9 0 1 1 -3.284 -5.997l-2.655 2.392a5.5 5.5 0 1 0 2.119 6.605h-4.125v-3h7.945z" />
                  </svg>
                  Sign up with Google
                </button>
              </div>
              <div className="col">
                <button
                  type="button"
                  className="btn w-100"
                  onClick={() => handleOAuth('azure')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="icon" width="24" height="24"
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12l4 -4l4 4l4 -4l4 4" />
                    <path d="M3 20l4 -4l4 4l4 -4l4 4" />
                  </svg>
                  Sign up with Microsoft
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-secondary mt-3">
          Already have an account?{' '}
          <Link href="/app/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
