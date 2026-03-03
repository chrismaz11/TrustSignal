export function FooterCta() {
  return (
    <section id="contact" className="landing-section footer-cta">
      <div className="landing-shell">
        <div className="footer-cta__panel">
          <p className="section-kicker">Get Started</p>
          <h2>Stop Deed Fraud Before It Becomes Loss</h2>
          <p className="muted">
            Book a technical walkthrough for your county, title workflow, or underwriting team.
          </p>
          <div className="footer-cta__actions">
            <a className="button" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Demo">
              Schedule Demo
            </a>
            <a className="button button-secondary" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Pricing">
              Request Pricing
            </a>
          </div>
          <p className="footer-cta__email">
            <a href="mailto:contact@trustsignal.dev">contact@trustsignal.dev</a>
          </p>
        </div>
        <div className="footer-cta__meta">
          <p>2026 TrustSignal. Proprietary verification infrastructure for high-stakes records.</p>
          <p>Prove authenticity. Reveal nothing unnecessary.</p>
        </div>
      </div>
    </section>
  );
}
