import type { Metadata } from 'next';

import './globals.css';
import { SiteNav } from '../components/SiteNav';

export const metadata: Metadata = {
  title: 'TrustSignal | Cryptographic Fraud Prevention Platform',
  description:
    'TrustSignal prevents fraud in deeds, licenses, and credentials with zero-knowledge verification and tamper-evident proof anchoring.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main>
          <SiteNav />
          {children}
        </main>
      </body>
    </html>
  );
}
