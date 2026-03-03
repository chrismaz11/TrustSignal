import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';

import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'TrustSignal | Zero-Knowledge Verification Engine',
  description:
    'TrustSignal provides cryptographic verification for high-stakes records with deterministic policy checks and tamper-evident receipts.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body>
        <main>
          <header>
            <div>
              <div className="badge">TrustSignal</div>
              <h1>Verification Studio</h1>
              <p className="muted">DeedShield pilot workflows with cryptographic verification and auditable receipts.</p>
            </div>
            <nav>
              <Link href="/">Home</Link>
              <Link href="/verify">Verify</Link>
              <Link href="/receipts">Receipts</Link>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
