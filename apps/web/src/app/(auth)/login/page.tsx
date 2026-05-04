'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.push('/app/dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function handleOAuth(provider: 'google' | 'azure') {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/app/dashboard` }
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
            <h2 className="h2 text-center mb-4">Sign in to your account</h2>

            <form onSubmit={handleSubmit} autoComplete="off" noValidate>
              <div className="mb-3">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="your@company.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="mb-2">
                <label className="form-label">
                  Password
                  <span className="form-label-description">
                    <Link href="/app/forgot-password">Forgot password?</Link>
                  </span>
                </label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="Your password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="alert alert-danger mb-3" role="alert">
                  <div className="d-flex">
                    <div>{error}</div>
                  </div>
                </div>
              )}

              <div className="form-footer">
                <button
                  type="submit"
                  className="btn btn-primary w-100"
                  disabled={loading}
                >
                  {loading ? 'Signing in…' : 'Sign in'}
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
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="icon"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.945 11a9 9 0 1 1 -3.284 -5.997l-2.655 2.392a5.5 5.5 0 1 0 2.119 6.605h-4.125v-3h7.945z" />
                  </svg>
                  Continue with Google
                </button>
              </div>
              <div className="col">
                <button
                  type="button"
                  className="btn w-100"
                  onClick={() => handleOAuth('azure')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="icon"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12l4 -4l4 4l4 -4l4 4" />
                    <path d="M3 20l4 -4l4 4l4 -4l4 4" />
                  </svg>
                  Continue with Microsoft
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center text-secondary mt-3">
          Don&apos;t have an account?{' '}
          <Link href="/app/signup" tabIndex={-1}>
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
}
