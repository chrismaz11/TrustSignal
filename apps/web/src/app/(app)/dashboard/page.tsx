import { createClient } from '../../../lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/app/login');

  const displayName = user.user_metadata?.full_name ?? user.email ?? 'Operator';
  const companyName = user.user_metadata?.company_name;

  return (
    <>
      <div className="page-header d-print-none">
        <div className="container-xl">
          <div className="row g-2 align-items-center">
            <div className="col">
              <h2 className="page-title">Dashboard</h2>
              <div className="text-muted mt-1">
                Welcome back, <strong>{displayName}</strong>
                {companyName ? ` · ${companyName}` : ''}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="container-xl">
          <div className="row row-deck row-cards">

            <div className="col-sm-6 col-lg-3">
              <div className="card">
                <div className="card-body">
                  <div className="subheader">Verifications today</div>
                  <div className="h1 mb-3">—</div>
                  <div className="d-flex mb-2">
                    <div className="text-muted">Connect your API to see live data</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div className="card">
                <div className="card-body">
                  <div className="subheader">Receipts issued</div>
                  <div className="h1 mb-3">—</div>
                  <div className="d-flex mb-2">
                    <div className="text-muted">Anchored verifications</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div className="card">
                <div className="card-body">
                  <div className="subheader">Flags raised</div>
                  <div className="h1 mb-3">—</div>
                  <div className="d-flex mb-2">
                    <div className="text-muted">Fraud signals detected</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-sm-6 col-lg-3">
              <div className="card">
                <div className="card-body">
                  <div className="subheader">API keys active</div>
                  <div className="h1 mb-3">—</div>
                  <div className="d-flex mb-2">
                    <div className="text-muted">
                      <a href="/app/api-keys">Manage keys →</a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-12">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Quick actions</h3>
                </div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-md-4">
                      <a href="/app/console" className="card card-link">
                        <div className="card-body">
                          <div className="d-flex align-items-center mb-3">
                            <span className="badge bg-blue-lt p-2 me-3">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 7l5 5l-5 5" /><path d="M12 19l7 0" />
                              </svg>
                            </span>
                            <strong>Operator Console</strong>
                          </div>
                          <div className="text-muted small">
                            Submit a RON bundle for verification and anchor a receipt.
                          </div>
                        </div>
                      </a>
                    </div>
                    <div className="col-md-4">
                      <a href="/app/receipts" className="card card-link">
                        <div className="card-body">
                          <div className="d-flex align-items-center mb-3">
                            <span className="badge bg-green-lt p-2 me-3">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 21v-16a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v16l-3 -2l-2 2l-2 -2l-2 2l-2 -2l-3 2" />
                              </svg>
                            </span>
                            <strong>View Receipts</strong>
                          </div>
                          <div className="text-muted small">
                            Browse all issued verification receipts for your tenant.
                          </div>
                        </div>
                      </a>
                    </div>
                    <div className="col-md-4">
                      <a href="/app/api-keys" className="card card-link">
                        <div className="card-body">
                          <div className="d-flex align-items-center mb-3">
                            <span className="badge bg-yellow-lt p-2 me-3">
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"
                                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16.555 3.843l3.602 3.602a2.877 2.877 0 0 1 0 4.069l-2.643 2.643a2.877 2.877 0 0 1 -4.069 0l-.301 -.301l-6.558 6.558a2 2 0 0 1 -1.239 .578l-.175 .008h-1.172a1 1 0 0 1 -.993 -.883l-.007 -.117v-1.172a2 2 0 0 1 .467 -1.284l.119 -.13l.414 -.414h2v-2h2v-2l2.144 -2.144l-.301 -.301a2.877 2.877 0 0 1 0 -4.069l2.643 -2.643a2.877 2.877 0 0 1 4.069 0z" />
                              </svg>
                            </span>
                            <strong>API Keys</strong>
                          </div>
                          <div className="text-muted small">
                            Generate and rotate API keys for programmatic access.
                          </div>
                        </div>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
