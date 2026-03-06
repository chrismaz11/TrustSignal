type Tier = {
  name: string;
  monthly: string;
  yearly: string;
  yearlySavings?: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel: string;
};

const tiers: Tier[] = [
  {
    name: 'Starter',
    monthly: '$2,500/month',
    yearly: '$25,000/year',
    yearlySavings: 'save $5K',
    features: [
      'Up to 1,000 verifications/month',
      'REST API access',
      'Email support (48hr response)',
      'Standard integrations'
    ],
    ctaLabel: 'Schedule Demo'
  },
  {
    name: 'Professional',
    monthly: '$7,500/month',
    yearly: '$75,000/year',
    yearlySavings: 'save $15K',
    features: [
      'Up to 10,000 verifications/month',
      'Priority support (12hr response)',
      'Custom webhooks',
      'Dedicated account manager',
      'Quarterly security audits'
    ],
    highlighted: true,
    ctaLabel: 'Schedule Demo'
  },
  {
    name: 'Enterprise',
    monthly: 'Custom pricing (starting $20,000/month)',
    yearly: 'Custom annual contract',
    features: [
      'Unlimited verifications',
      '24/7 support + SLA guarantees',
      'On-premise deployment options',
      'Custom circuit development',
      'White-label capabilities',
      'Multi-chain deployment'
    ],
    ctaLabel: 'Request Custom Quote'
  }
];

export function PricingSection() {
  return (
    <section id="pricing" className="landing-section pricing-section pricing-section--dark">
      <div className="landing-shell">
        <div className="section-head">
          <p className="section-kicker">Pricing</p>
          <h2>Tiered Subscription Pricing</h2>
          <p className="muted">Monthly + yearly contracts. NO per-verification fees.</p>
        </div>

        <div className="pricing-grid">
          {tiers.map((tier) => (
            <article key={tier.name} className={`pricing-card${tier.highlighted ? ' pricing-card--highlighted' : ''}`}>
              {tier.highlighted ? <p className="pricing-card__badge">Most Popular</p> : null}
              <h3>{tier.name}</h3>
              <p className="pricing-card__price">{tier.monthly}</p>
              <p className="pricing-card__or">or {tier.yearly}</p>
              {tier.yearlySavings ? <p className="pricing-card__note">{tier.yearlySavings}</p> : null}
              <ul>
                {tier.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <a
                className={`button ${tier.highlighted ? '' : 'button-secondary'}`}
                href={`mailto:contact@trustsignal.dev?subject=${encodeURIComponent(`TrustSignal ${tier.name}`)}`}
              >
                {tier.ctaLabel}
              </a>
            </article>
          ))}
        </div>

        <div className="pricing-cta-row">
          <a className="button button-secondary" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Custom%20Quote">
            Request Custom Quote
          </a>
          <a className="button" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Demo">
            Schedule Demo
          </a>
        </div>

        <p className="enterprise-footnote pricing-footnote">
          *All pricing in USD. Annual pricing billed upfront. Verification limits reset monthly. Enterprise pricing
          negotiated per contract. TrustSignal reserves the right to modify pricing with 30 days notice. Custom
          deployment and white-label agreements subject to separate licensing terms.
        </p>
      </div>
    </section>
  );
}
