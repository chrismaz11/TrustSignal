'use client';

import { useState } from 'react';

type UseCaseTab = {
  id: 'deed' | 'healthcare' | 'legal' | 'zero-pii';
  label: string;
  header: string;
  stats: Array<{ text: string; source: string; href: string }>;
  copy: string[];
};

const tabs: UseCaseTab[] = [
  {
    id: 'deed',
    label: 'Deed Fraud',
    header: 'The Systemic Flaw in Property Recording',
    stats: [
      {
        text: 'Real estate fraud losses reached $173M in 2024 (FBI/FundingShield).',
        source: 'First American / FundingShield',
        href: 'https://www.facebook.com/FirstAmericanTitle/posts/real-estate-fraud-losses-hit-173m-in-2024-do-you-know-how-to-protect-yourself-an/1213416000800635/'
      },
      {
        text: 'Average fraud and forgery claim: $143,000 per incident (ALTA/Milliman, 2024).',
        source: 'ALTA/Milliman',
        href: 'https://www.alta.org/news-and-publications/news/20240528-Average-Title-Insurance-Claim-Cost-for-Fraud-and-Forgery-is-143000'
      },
      {
        text: 'Fraud and forgery claims rose from 19% to 44% of title claims (ALTA/Milliman).',
        source: 'ALTA/Milliman',
        href: 'https://www.alta.org/news-and-publications/news/20240528-Average-Title-Insurance-Claim-Cost-for-Fraud-and-Forgery-is-143000'
      },
      {
        text: 'For every $1 lost to fraud, remediation costs $4.23 (LexisNexis, 2022).',
        source: 'LexisNexis (via FSTE)',
        href: 'https://www.fste.com/cost-of-mortgage-fraud-is-way-up/'
      }
    ],
    copy: ['TrustSignal catches fraud at submission, not after recording.']
  },
  {
    id: 'healthcare',
    label: 'Healthcare Licenses',
    header: "License Verification Takes 60-120 Days. It Shouldn't.",
    stats: [
      {
        text: 'Provider credentialing averages 60-180 days.',
        source: 'Atlas Systems, 2026',
        href: 'https://www.atlassystems.com/blog/credentialing-turnaround-time'
      },
      {
        text: 'Revenue loss during delay: $100,000-$450,000 per provider.',
        source: 'DirectShifts, 2025',
        href: 'https://www.directshifts.com/employer-resources/healthcare-provider-credentialing-costs-breakdown-roi-strategies-for-healthcare-employers'
      },
      {
        text: 'Specialists generating $5,000-10,000/day can lose up to $1.2M while waiting.',
        source: 'HOMRCM, 2025',
        href: 'https://www.homrcm.com/blogs/healthcare-credentialing-delays-how-90-day-bottlenecks-cost-practices-thousands'
      },
      {
        text: 'Average physician loss during credentialing: up to $122,144.',
        source: 'Atlas Systems, 2026',
        href: 'https://www.atlassystems.com/blog/credentialing-turnaround-time'
      }
    ],
    copy: [
      'TrustSignal issues cryptographic credentials verified in 1.5 seconds with no database query dependency.'
    ]
  },
  {
    id: 'legal',
    label: 'Legal Documents',
    header: 'Contract Fraud Generates Billions in Annual Litigation',
    stats: [
      {
        text: 'Excess litigation in the US costs $367.8 billion annually.',
        source: 'ATRA, 2025',
        href: 'https://atra.org/fraud-on-the-rise-new-atra-report-exposes-systemic-lawsuit-abuse-in-civil-courts/'
      },
      {
        text: 'Consumers reported $12.5B lost to fraud in 2024, up 25% year-over-year.',
        source: 'FTC, 2025',
        href: 'https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024'
      },
      {
        text: 'FCA fraud settlements and judgments exceeded $2.68B in FY2023.',
        source: 'PilieroMazza, 2023',
        href: 'https://www.pilieromazza.com/settlements-and-judgments-from-fca-and-fraud-matters-top-2-68-billion-in-2023/'
      }
    ],
    copy: [
      'Traditional signature verification relies on notarization, a process exposed to forgery, bribery, and human error.',
      'TrustSignal replaces notarization with cryptographic signer identity proofs.',
      'Proof of who signed, what was signed, and when is mathematically verifiable.'
    ]
  },
  {
    id: 'zero-pii',
    label: 'Zero PII',
    header: 'Verify Identity Without Exposing Identity',
    stats: [
      {
        text: '1.1 million identity theft reports were filed in 2024.',
        source: 'FTC, 2025',
        href: 'https://www.ftc.gov/news-events/news/press-releases/2025/03/new-ftc-data-show-big-jump-reported-losses-fraud-125-billion-2024'
      },
      {
        text: 'GDPR fines can reach EUR 20M or 4% of annual global turnover.',
        source: 'GDPR Article 83',
        href: 'https://gdpr-info.eu/art-83-gdpr/'
      },
      {
        text: 'HIPAA civil penalties can reach up to $50,000 per violation and annual maximums per tier.',
        source: 'HHS OCR',
        href: 'https://www.hhs.gov/hipaa/for-professionals/compliance-enforcement/agreements/index.html'
      }
    ],
    copy: [
      'TrustSignal uses zero-knowledge proofs to validate claims without disclosing underlying identity data.',
      'No PII is required for verifier-side proof checks.',
      'Supports HIPAA and GDPR data-minimization posture; regulatory compliance depends on system implementation and governance.'
    ]
  }
];

export function UseCaseTabs() {
  const [activeId, setActiveId] = useState<UseCaseTab['id']>('deed');
  const activeTab = tabs.find((item) => item.id === activeId) ?? tabs[0];

  return (
    <section className="use-cases">
      <div className="use-cases__tablist tab-list" role="tablist" aria-label="Use case tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeId === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            className={`use-cases__tab ${activeId === tab.id ? 'is-active' : ''}`}
            onClick={() => setActiveId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panel-${activeTab.id}`}
        aria-labelledby={`tab-${activeTab.id}`}
        className="use-cases__panel tab-panel"
      >
        <div className="use-cases__content">
          <h3>{activeTab.header}</h3>
          <ul className="use-cases__stats">
            {activeTab.stats.map((stat) => (
              <li key={`${activeTab.id}-${stat.text}`}>
                <span>{stat.text}</span>{' '}
                <a href={stat.href} target="_blank" rel="noreferrer">
                  ({stat.source})
                </a>
              </li>
            ))}
          </ul>
          <div className="use-cases__body">
            {activeTab.copy.map((line) => (
              <p key={`${activeTab.id}-${line}`}>{line}</p>
            ))}
          </div>
        </div>

        <div className={`use-cases__visual use-cases__visual--${activeTab.id}`}>
          {activeTab.id === 'deed' ? (
            <div className="split-flow">
              <div className="split-flow__panel split-flow__panel--risk">
                <p className="split-flow__title">Traditional Process</p>
                <p>Submit Deed</p>
                <p>Manual Review</p>
                <p>Recorded</p>
                <p>Fraud Detected (months later)</p>
              </div>
              <div className="split-flow__panel split-flow__panel--safe">
                <p className="split-flow__title">TrustSignal</p>
                <p>Submit Deed</p>
                <p>TrustSignal ZK Verification (1.5s)</p>
                <p>Block or Approve</p>
              </div>
            </div>
          ) : null}

          {activeTab.id === 'healthcare' ? (
            <div className="timeline-compare">
              <div>
                <p className="timeline-compare__title">Traditional</p>
                <p>Day 1 - Day 60 - Day 90 - Day 180 (approved)</p>
              </div>
              <div>
                <p className="timeline-compare__title">TrustSignal</p>
                <p>Day 1 - 1.5 seconds (verified)</p>
              </div>
              <p className="timeline-compare__loss">$122,144 average revenue lost during credentialing wait.</p>
            </div>
          ) : null}

          {activeTab.id === 'legal' ? (
            <div className="split-flow">
              <div className="split-flow__panel split-flow__panel--risk">
                <p className="split-flow__title">Traditional</p>
                <p>Notary Stamp</p>
                <p>Signature</p>
                <p>Trust (forgeable)</p>
              </div>
              <div className="split-flow__panel split-flow__panel--safe">
                <p className="split-flow__title">TrustSignal</p>
                <p>ZK Proof</p>
                <p>Anchored Hash</p>
                <p>Verification (unforgeable)</p>
              </div>
            </div>
          ) : null}

          {activeTab.id === 'zero-pii' ? (
            <div className="pii-grid">
              <p className="pii-grid__head">Traditional Verification</p>
              <p className="pii-grid__head">TrustSignal</p>
              <p>Full Name exposed</p>
              <p>ZERO</p>
              <p>Date of Birth exposed</p>
              <p>ZERO</p>
              <p>SSN / Tax ID exposed</p>
              <p>ZERO</p>
              <p>Address exposed</p>
              <p>ZERO</p>
              <p>License Number exposed</p>
              <p>ZERO</p>
              <p className="pii-grid__claim">Only claim proven</p>
              <p className="pii-grid__claim">Claim proven</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
