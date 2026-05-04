'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const DASHBOARD_ROUTES = ['/verify', '/receipts', '/receipt', '/settings'];

function isDashboardRoute(path: string) {
  return DASHBOARD_ROUTES.some((r) => path === r || path.startsWith(r + '/'));
}

export function SiteNav() {
  const pathname = usePathname();

  if (isDashboardRoute(pathname)) {
    return (
      <header className="site-header dashboard-header">
        <div className="dashboard-brand">
          <Link href="/" className="dashboard-logo">TrustSignal</Link>
          <span className="dashboard-label">Operator Console</span>
        </div>
        <nav className="dashboard-nav">
          <Link href="/verify" className={pathname === '/verify' ? 'active' : ''}>Console</Link>
          <Link href="/receipts" className={pathname.startsWith('/receipt') ? 'active' : ''}>Receipts</Link>
          <Link href="/settings" className={pathname === '/settings' ? 'active' : ''}>Settings</Link>
        </nav>
      </header>
    );
  }

  return (
    <header className="site-header">
      <div>
        <div className="badge">TrustSignal</div>
      </div>
      <nav>
        <Link href="/">Platform</Link>
        <Link href="/#pricing">Pricing</Link>
        <Link href="/verify">Console</Link>
        <a href="mailto:contact@trustsignal.dev">Schedule Demo</a>
      </nav>
    </header>
  );
}
