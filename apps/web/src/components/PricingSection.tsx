'use client';

import { useState } from 'react';

type Tier = {
  name: string;
  monthly: string;
  yearly: string;
  yearlyNote: string;
  features: string[];
  highlighted?: boolean;
};

const tiers: Tier[] = [
  {
    name: 'Starter',
    monthly: '$2,500',
    yearly: '$25,000',
    yearlyNote: 'Save $5,000 annually',
    features: [
      'Up to 1,000 verifications per month',
      'REST API and dashboard access',
      'Email support (48-hour response)',
      'Standard policy templates'
    ]
  },
  {
    name: 'Professional',
    monthly: '$7,500',
    yearly: '$75,000',
    yearlyNote: 'Save $15,000 annually',
    features: [
      'Up to 10,000 verifications per month',
      'Priority support (12-hour response)',
      'Webhook and SIEM integrations',
      'Dedicated pilot success lead',
      'Quarterly security review'
    ],
    highlighted: true
  },
  {
    name: 'Enterprise',
    monthly: 'Custom',
    yearly: 'Custom',
    yearlyNote: 'Pricing based on scope',
    features: [
      'Unlimited volume and custom SLAs',
      '24/7 incident response channel',
      'Private deployment options',
      'Custom workflow and attestations',
      'Multi-jurisdiction controls'
    ]
  }
];

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="pricing" className="landing-section pricing-section">
      <div className="landing-shell">
        <div className="section-head">
          <p className="section-kicker">Pricing</p>
          <h2>Subscription Tiers</h2>
          <p className="muted">Predictable subscription pricing for pilot programs through enterprise scale.</p>
        </div>

        <div className="pricing-toggle" role="group" aria-label="Billing cycle">
          <button
            type="button"
            className={`pricing-toggle__button ${!yearly ? 'is-active' : ''}`}
            onClick={() => setYearly(false)}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`pricing-toggle__button ${yearly ? 'is-active' : ''}`}
            onClick={() => setYearly(true)}
          >
            Yearly
          </button>
          {yearly ? <span className="pricing-toggle__note">Best value</span> : null}
        </div>

        <div className="pricing-grid">
          {tiers.map((tier) => (
            <article key={tier.name} className={`pricing-card${tier.highlighted ? ' pricing-card--highlighted' : ''}`}>
              {tier.highlighted ? <p className="pricing-card__badge">Most popular</p> : null}
              <h3>{tier.name}</h3>
              <p className="pricing-card__price">
                {yearly ? tier.yearly : tier.monthly}
                <span>{yearly ? '/year' : '/month'}</span>
              </p>
              <p className="pricing-card__note">{yearly ? tier.yearlyNote : 'No per-verification overages'}</p>
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a className={`button ${tier.highlighted ? '' : 'button-secondary'}`} href="mailto:contact@trustsignal.dev">
                {tier.name === 'Enterprise' ? 'Request Quote' : 'Schedule Demo'}
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
