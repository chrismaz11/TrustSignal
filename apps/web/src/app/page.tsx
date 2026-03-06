import { UseCaseTabs } from '../components/UseCaseTabs';
import { FooterCta } from '../components/FooterCta';
import { PricingSection } from '../components/PricingSection';

const stats = ['1.5s Verification*', '99.8% Fraud Detection*', '1,024 Verification Gates*', '99.34% Test Coverage*'];

const capabilityFacts = [
  'Cryptographic proof of document authenticity using zero-knowledge circuits (Halo2)',
  'AI fraud scoring with verifiable machine learning (ezkl) - not a black box',
  'Immutable proof anchoring to EVM chains (Polygon) - tamper-evident audit trail'
];

const technicalSpecs = [
  'Cryptography: halo2_proofs 0.3, Poseidon hash, ezkl ZKML',
  'Stack: Fastify v5 REST API, TypeScript SDK, Rust circuits, Prisma ORM',
  'Infrastructure: EVM-compatible chains, 99.34% test coverage, enterprise SLA',
  'Integration: REST API, webhooks, zero-dependency SDK'
];

const workflow = [
  {
    title: 'Submit',
    detail: 'Document uploaded via REST API or SDK',
    glyph: 'upload'
  },
  {
    title: 'Verify',
    detail: 'ZK circuits execute verification in 1.5s',
    glyph: 'circuit'
  },
  {
    title: 'Detect',
    detail: 'ZKML fraud scoring runs with verifiable model outputs',
    glyph: 'detect'
  },
  {
    title: 'Anchor',
    detail: 'Cryptographic proof stored on-chain, immutable record generated',
    glyph: 'anchor'
  },
  {
    title: 'Revoke',
    detail: 'Nullifier updates enforce revocation state across verifiers',
    glyph: 'revoke'
  }
];

const stackGrid = [
  { title: 'ZK Core', detail: 'halo2_proofs 0.3 + Poseidon hash' },
  { title: 'ZKML', detail: 'ezkl verifiable machine learning' },
  { title: 'Revocation', detail: 'Nullifier-based revocation checks' },
  { title: 'EVM Anchor', detail: 'Polygon-compatible immutable anchoring' },
  { title: 'REST API', detail: 'Fastify v5 verification endpoints' },
  { title: 'TypeScript SDK', detail: 'Zero-dependency client integration' }
];

export default function HomePage() {
  return (
    <div className="enterprise-page dark-proof">
      <section id="hero" className="landing-section enterprise-hero">
        <div className="landing-shell enterprise-hero__grid">
          <article>
            <p className="section-kicker">TrustSignal</p>
            <h2>Cryptographic Fraud Prevention for High-Stakes Documents</h2>
            <p className="enterprise-hero__subhead">
              Stop fraudulent deeds, licenses, and credentials before they&apos;re recorded. Zero-knowledge verification
              in 1.5 seconds without exposing sensitive data.
            </p>
            <div className="hero-actions">
              <a className="button button-large" href="mailto:contact@trustsignal.dev">
                Schedule Demo
              </a>
              <a className="button button-secondary button-large" href="#pricing">
                View Pricing
              </a>
            </div>
            <p className="hero-copyright">
              &copy; 2026 TrustSignal. All Rights Reserved. Proprietary cryptographic fraud prevention platform.
            </p>
          </article>
          <aside className="card enterprise-proof hero-proof">
            <h3>Cryptographic Proof Pipeline</h3>
            <div className="hero-proof__icon" aria-hidden="true">
              <span className="hero-proof__lock" />
              <span className="hero-proof__check" />
            </div>
            <div className="enterprise-proof__flow" aria-label="Proof flow diagram">
              <div className="enterprise-proof__node">Submit</div>
              <div className="enterprise-proof__connector" />
              <div className="enterprise-proof__node">Verify</div>
              <div className="enterprise-proof__connector" />
              <div className="enterprise-proof__node">Anchor</div>
            </div>
          </aside>
        </div>
      </section>

      <section className="landing-section enterprise-stats">
        <div className="landing-shell">
          <div className="enterprise-stats__grid">
            {stats.map((stat) => (
              <p key={stat}>{stat}</p>
            ))}
          </div>
          <p className="enterprise-stats__note">
            *Based on internal testing. Results may vary by document type and volume.
          </p>
        </div>
      </section>

      <section id="what-it-does" className="landing-section">
        <div className="landing-shell section-head">
          <p className="section-kicker">What It Does</p>
          <h2>Verification Outputs Are Cryptographically Auditable</h2>
          <ul className="enterprise-list">
            {capabilityFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      </section>

      <section id="applications" className="landing-section">
        <div className="landing-shell">
          <div className="section-head">
            <p className="section-kicker">Interactive Use Cases</p>
            <h2>Fraud, Delay, and Exposure by Workflow Type</h2>
          </div>
          <UseCaseTabs />
        </div>
      </section>

      <section id="how-it-works" className="landing-section">
        <div className="landing-shell">
          <div className="section-head">
            <p className="section-kicker">How It Works</p>
            <h2>Internal Verification Architecture</h2>
          </div>
          <div className="card vertical-flow" aria-label="Vertical circuit flow diagram">
            {workflow.map((step, index) => (
              <div key={step.title} className="vertical-flow__row">
                <div className={`vertical-flow__glyph vertical-flow__glyph--${step.glyph}`} />
                <div className="vertical-flow__text">
                  <p className="enterprise-step__index">
                    Step {index + 1}: {step.title}
                  </p>
                  <p>{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="enterprise-footnote">
            *Process based on TrustSignal internal architecture. Performance metrics based on internal testing
            environments.
          </p>
        </div>
      </section>

      <section id="technical-specs" className="landing-section">
        <div className="landing-shell">
          <div className="section-head">
            <p className="section-kicker">Technical Specs</p>
            <h2>Implementation Baseline for IT Security and Architecture Teams</h2>
          </div>
          <div className="tech-grid" aria-label="Technical stack grid">
            {stackGrid.map((item) => (
              <article key={item.title} className="tech-grid__item">
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
              </article>
            ))}
          </div>
          <ul className="enterprise-list enterprise-list--specs">
            {technicalSpecs.map((spec) => (
              <li key={spec}>{spec}</li>
            ))}
          </ul>
          <p className="enterprise-footnote">
            *Stack specifications reflect current production architecture. Subject to change without notice.
          </p>
          <p className="enterprise-nda-note">Technical Architecture available under NDA.</p>
        </div>
      </section>

      <PricingSection />
      <FooterCta />
    </div>
  );
}
