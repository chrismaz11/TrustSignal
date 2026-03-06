import type { Metadata } from 'next';
import { IBM_Plex_Mono, Space_Grotesk } from 'next/font/google';
import Link from 'next/link';

import './globals.css';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-sans' });
const ibmPlexMono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '600'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'TrustSignal | Cryptographic Fraud Prevention Platform',
  description:
    'TrustSignal prevents fraud in deeds, licenses, and credentials with zero-knowledge verification and tamper-evident proof anchoring.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${ibmPlexMono.variable}`}>
      <body>
        <main>
          <header className="site-header">
            <div>
              <div className="badge">TrustSignal</div>
            </div>
            <nav>
              <Link href="/">Platform</Link>
              <Link href="/#pricing">Pricing</Link>
              <Link href="/verify">Verify</Link>
              <Link href="/receipts">Receipts</Link>
              <a href="mailto:contact@trustsignal.dev">Schedule Demo</a>
            </nav>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
