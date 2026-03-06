import Link from 'next/link';

export function FooterCta() {
  return (
    <footer id="contact" className="landing-section footer-cta footer-cta--dark">
      <div className="landing-shell">
        <div className="footer-cta__panel">
          <h2>Stop Fraud Before It Costs Millions</h2>
          <div className="footer-cta__actions">
            <a className="button" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Demo">
              Schedule Demo
            </a>
            <a className="button button-secondary" href="mailto:contact@trustsignal.dev?subject=TrustSignal%20Pricing">
              Request Pricing
            </a>
            <a className="footer-cta__email" href="mailto:contact@trustsignal.dev">
              contact@trustsignal.dev
            </a>
          </div>
        </div>

        <div className="footer-legal">
          <p>
            &copy; 2026 TrustSignal. All Rights Reserved. Proprietary cryptographic fraud prevention platform. Patent
            pending. TrustSignal and the TrustSignal logo are trademarks of TrustSignal LLC.
          </p>
          <p>
            Technical architecture and source code are proprietary and confidential. Available for review under NDA by
            qualified enterprise customers only.
          </p>
          <p>
            Statistics sourced from: FBI Internet Crime Report (2024), ALTA/Milliman (2024), FTC Consumer Sentinel
            (2025), LexisNexis True Cost of Fraud (2022), ATRA (2025), Atlas Systems (2026), DirectShifts (2025).
            Internal performance metrics based on controlled testing environments.
          </p>
          <div className="footer-legal__links">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-of-service">Terms of Service</Link>
            <Link href="/security">Security</Link>
            <a href="mailto:contact@trustsignal.dev">contact@trustsignal.dev</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
