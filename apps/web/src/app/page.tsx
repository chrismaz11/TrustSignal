import Link from 'next/link';

import { FooterCta } from '../components/FooterCta';
import { FileDropzone } from '../components/FileDropzone';
import { PricingSection } from '../components/PricingSection';
import { SideNav } from '../components/SideNav';

const trustSignals = [
  {
    title: 'Cryptographic Integrity',
    detail: 'Canonical document hashing with reproducible receipts for independent verification.'
  },
  {
    title: 'Registry Cross-Checks',
    detail: 'Notary and trust-source validation against signed registries and policy profiles.'
  },
  {
    title: 'Tamper-Evident Evidence',
    detail: 'Anchored receipt hashes and immutable audit traces for downstream adjudication.'
  }
];

const processSteps = [
  'Parse and hash deed bundle inputs.',
  'Evaluate trust registry and credential assertions.',
  'Score policy and risk outcomes with deterministic rules.',
  'Issue canonical receipt and optional EVM anchor.'
];

export default function HomePage() {
  return (
    <div className="landing-page">
      <aside className="landing-page__rail">
        <SideNav />
      </aside>
      <div className="landing-page__content">
        <section id="hero" className="landing-section">
          <div className="landing-shell hero-grid">
            <article className="card">
              <p className="section-kicker">TrustSignal</p>
              <h2>Verification Engine for High-Stakes Property Records</h2>
              <p className="muted">
                Validate document integrity, notary trust, and fraud posture before filing, underwriting, or transfer.
              </p>
              <div className="hero-actions">
                <Link className="button" href="/verify">
                  Run Verification
                </Link>
                <Link className="button button-secondary" href="/receipts">
                  Browse Receipts
                </Link>
              </div>

              <div className="hero-precheck">
                <h3>Instant Pre-Check</h3>
                <FileDropzone />
              </div>
            </article>
            <article className="card">
              <h3>How TrustSignal Works</h3>
              <ol className="muted">
                {processSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </article>
          </div>
        </section>

        <section id="signals" className="landing-section">
          <div className="landing-shell">
            <div className="section-head">
              <p className="section-kicker">Signals</p>
              <h2>Decision-Grade Evidence</h2>
              <p className="muted">
                Outputs are designed for title ops, legal review, and insurance workflows that need clear provenance.
              </p>
            </div>
            <div className="signal-grid">
              {trustSignals.map((signal) => (
                <article key={signal.title} className="card signal-card">
                  <h3>{signal.title}</h3>
                  <p className="muted">{signal.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <PricingSection />
        <FooterCta />
      </div>
    </div>
  );
}
