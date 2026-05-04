'use client';

import { useEffect, useRef, useState } from 'react';
import { Terminal } from './Terminal';
import { TrustSignalLogo } from './TrustSignalLogo';
import styles from './ScrollytellingDemo.module.css';

const STEPS = [
  {
    number: '00',
    heading: 'Document enters the workflow',
    narrative:
      'A mortgage bank statement is uploaded to the lender's intake portal. TrustSignal intercepts it at the ingestion boundary.',
    flash: undefined as 'success' | 'error' | undefined,
    terminal: `$ cat loan-bank-statement.json

{
  "artifactType": "Mortgage Bank Statement",
  "artifactId": "ART-LNDR-2026-0314-00017",
  "borrowerId": "BRW-104882",
  "loanId": "LN-9927415",
  "statementDate": "2026-03-14",
  "uploadedAt": "2026-03-14T10:22:16Z",
  "lender": "North River Lending",
  "documentOwner": "Borrower Upload Portal",
  "policyProfile": "EVIDENCE_INTEGRITY_STANDARD",
  "evidence": {
    "sourceRecord": "Borrower upload ingestion stream",
    "checksumAlgorithm": "SHA-256",
    "pageCount": 5
  }
}`,
  },
  {
    number: '01',
    heading: 'SHA-256 fingerprint locked at intake',
    narrative:
      'A cryptographic digest is computed from the raw file bytes the moment it arrives. This digest becomes the unchangeable baseline.',
    flash: undefined as 'success' | 'error' | undefined,
    terminal: `$ sha256sum loan-bank-statement.json

a3f1d9e2b84c7056f3a2d1e9b74c8f52
3d6a1e7c9b4f2d8e5a3c7f1b6d4e9a2c
  loan-bank-statement.json

Digest bound to receipt at 2026-03-14T10:22:16Z ✓`,
  },
  {
    number: '02',
    heading: 'Receipt binds proof to the file',
    narrative:
      'TrustSignal issues a signed receipt — a portable, replayable record tying the digest, timestamp, and policy profile to this document.',
    flash: 'success' as const,
    terminal: `{
  "receiptId": "rcpt_a3f1d9e2b84c7056",
  "status": "ISSUED",
  "timestamp": "2026-03-14 10:22:16 UTC",
  "sourceDigest": "a3f1d9e2b84c7056f3a2d1e9b74c8f52...",
  "receiptDigest": "7c4b2a9d1e6f3b8c5a2d7e1f4b9c3a6d...",
  "policyProfile": "EVIDENCE_INTEGRITY_STANDARD",
  "signature": "Ed25519"
}`,
  },
  {
    number: '03',
    heading: 'Secondary market transfer',
    narrative:
      'The loan is sold to Fannie Mae. The receipt reference travels with the file through the transfer — the chain of custody is intact.',
    flash: undefined as 'success' | 'error' | undefined,
    terminal: `TRANSFER LOG
────────────────────────────────────────
Loan ID      LN-9927415
Sold to      Fannie Mae
Transfer at  2026-03-28T16:05:00Z
Receipt ref  rcpt_a3f1d9e2b84c7056
────────────────────────────────────────
Status       TRANSFERRED — receipt intact ✓`,
  },
  {
    number: '04',
    heading: 'Six months later: repurchase review',
    narrative:
      'A repurchase request arrives. The reviewer replays the receipt against the file currently on record.',
    flash: undefined as 'success' | 'error' | undefined,
    terminal: `$ trustsignal verify \\
    --receipt rcpt_a3f1d9e2b84c7056 \\
    --artifact loan-bank-statement.json

Replaying integrity checks...
  [DONE] Borrower intake
  [DONE] Receipt issuance
  [DONE] Secondary market transfer
  [RUN ] Repurchase review...`,
  },
  {
    number: '05',
    heading: 'Evidence chain intact',
    narrative:
      'The digest computed today matches the receipt issued at intake. The document was not altered. No repurchase exposure.',
    flash: 'success' as const,
    terminal: `Expected  a3f1d9e2b84c7056f3a2d1e9b74c8f52...
Observed  a3f1d9e2b84c7056f3a2d1e9b74c8f52...

✓  VERIFIED
   Source digest matches the issued receipt.
   Repurchase claim: NO EXPOSURE`,
  },
  {
    number: '06',
    heading: 'What if the file was changed?',
    narrative:
      'If a modified version of the document is presented, the digests diverge immediately. TrustSignal catches it before any claim is processed.',
    flash: 'error' as const,
    terminal: `Expected  a3f1d9e2b84c7056f3a2d1e9b74c8f52...
Observed  a3f1d9e2b84c7056f3a2d1e9b74c1c99...
                                        ^^^^

✗  FAILED
   Observed digest diverged from baseline.
   Repurchase claim: EXPOSURE DETECTED`,
  },
] as const;

const PROBLEM_CARDS = [
  {
    num: '01',
    title: 'Evidence gets silently modified',
    text: 'Documents change between intake and review with no reliable way to detect when or by whom.',
  },
  {
    num: '02',
    title: 'Audit trails are fragmented',
    text: 'Lenders, servicers, and agencies each hold partial records. There is no single authoritative source of truth.',
  },
  {
    num: '03',
    title: 'Exposure goes undetected',
    text: 'Repurchase demands and legal disputes arrive months later, long after the tamper window has closed.',
  },
];

export function ScrollytellingDemo() {
  const [activeStep, setActiveStep] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observers = stepRefs.current.map((ref, index) => {
      if (!ref) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveStep(index);
        },
        {
          root: container,
          rootMargin: '-35% 0px -35% 0px',
        }
      );
      obs.observe(ref);
      return obs;
    });

    return () => {
      observers.forEach((obs) => obs?.disconnect());
    };
  }, []);

  const railHeight = `${((activeStep + 1) / STEPS.length) * 100}%`;
  const step = STEPS[activeStep];

  return (
    <div ref={containerRef} className={styles.page}>
      {/* Nav */}
      <nav className={styles.nav}>
        <TrustSignalLogo size={28} showWordmark={true} />
        <div className={styles.navLinks}>
          <a href="https://trustsignal.dev" className={styles.navLink}>
            Platform
          </a>
          <a href="https://trustsignal.dev/#pricing" className={styles.navLink}>
            Pricing
          </a>
          <a href="mailto:contact@trustsignal.dev" className={styles.navCta}>
            Schedule Demo
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroEyebrow}>
          <TrustSignalLogo size={36} showWordmark={false} />
        </div>
        <h1 className={styles.heroTitle}>
          Evidence doesn&apos;t lie.
          <br />
          <em>Until it does.</em>
        </h1>
        <p className={styles.heroDesc}>
          TrustSignal binds a tamper-evident receipt to a document the moment it enters your
          workflow. At repurchase review, audit, or litigation — replay the receipt to prove whether
          the document was altered.
        </p>
        <a href="#demo" className={styles.heroCta}>
          See how it works ↓
        </a>
        <div className={styles.heroScroll}>
          <span className={styles.heroScrollLine} />
          Scroll to explore
        </div>
      </section>

      {/* Problem */}
      <section className={styles.problem}>
        <p className={styles.sectionLabel}>The problem</p>
        <div className={styles.problemGrid}>
          {PROBLEM_CARDS.map((card) => (
            <div key={card.num} className={styles.problemCard}>
              <span className={styles.problemNum}>{card.num}</span>
              <h3 className={styles.problemCardTitle}>{card.title}</h3>
              <p className={styles.problemCardText}>{card.text}</p>
            </div>
          ))}
        </div>
        <p className={styles.problemTransition}>
          <strong>TrustSignal makes evidence tamper-evident and audit-ready</strong> from the moment
          it enters your workflow.
        </p>
      </section>

      {/* Scrollytelling */}
      <section id="demo" className={styles.scrollSection}>
        {/* Left: step cards */}
        <div className={styles.leftCol}>
          <div className={styles.rail}>
            <div className={styles.railFill} style={{ height: railHeight }} />
          </div>

          {STEPS.map((s, i) => (
            <article
              key={s.number}
              ref={(el) => {
                stepRefs.current[i] = el;
              }}
              className={`${styles.stepCard} ${i === activeStep ? styles.active : ''}`}
            >
              <div className={styles.stepActive} />
              <span className={styles.stepNumber}>{s.number}</span>
              <h2 className={styles.stepHeading}>{s.heading}</h2>
              <p className={styles.stepNarrative}>{s.narrative}</p>
            </article>
          ))}
        </div>

        {/* Right: sticky terminal */}
        <div className={styles.rightCol}>
          <Terminal content={step.terminal} stepIndex={activeStep} flash={step.flash} />
        </div>
      </section>

      {/* Outro */}
      <section className={styles.outro}>
        <p className={styles.outroLabel}>Ready to verify</p>
        <h2 className={styles.outroTitle}>
          Every document.
          <br />
          Every time.
        </h2>
        <p className={styles.outroSub}>
          TrustSignal integrates at the intake boundary and issues receipts automatically — no
          workflow changes required.
        </p>
        <div className={styles.outroActions}>
          <a href="mailto:contact@trustsignal.dev" className={styles.ctaPrimary}>
            Schedule a demo
          </a>
          <a href="https://trustsignal.dev" className={styles.ctaSecondary}>
            Learn more →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <TrustSignalLogo size={20} showWordmark={true} />
        <span className={styles.footerNote}>Evidence Integrity Infrastructure</span>
      </footer>
    </div>
  );
}
