import { Fraunces } from 'next/font/google';
import type { Metadata } from 'next';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TrustSignal — Evidence Integrity Infrastructure Demo',
  description:
    'See how TrustSignal binds tamper-evident receipts to documents at ingestion and replays them at repurchase review, audit, or litigation.',
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return <div className={fraunces.variable}>{children}</div>;
}
