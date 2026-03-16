**Navigation**

- [Home](Home.md)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# Claims Boundary

Short description:
This page defines what TrustSignal public materials do and do not claim across signed verification receipts, verification signals, verifiable provenance, later verification, and existing workflow integration.

Audience:
- evaluators
- partner reviewers
- documentation authors

## Problem / Context

Public integrations need a clear technical boundary so partner engineers and reviewers know what the TrustSignal response means and what it does not mean.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer for existing workflows and provides:

- signed verification receipts
- verification signals
- verifiable provenance metadata
- later verification capability
- API-accessible receipt lifecycle state

## How It Works

The public TrustSignal position should be read through the integrity layer:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration

## Integration Fit

TrustSignal is designed to sit behind an upstream workflow that remains the system of record. The partner or workflow owner keeps control of collection, review, and business decisions.

## Security And Claims Boundary

> [!NOTE]
> Claims boundary: public TrustSignal documents describe technical verification artifacts and the integrity layer. They do not create legal determinations, compliance certifications, or environment-specific infrastructure guarantees.

## Technical Detail

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- a replacement for system-of-record workflows
- guarantees that depend on environment-specific infrastructure evidence outside this repository

The TrustSignal response should be treated as a technical verification artifact that supports audit-ready evidence and later verification.

## Related Documentation

- [README.md](/Users/christopher/Projects/trustsignal/README.md)
- [docs/security-summary.md](/Users/christopher/Projects/trustsignal/docs/security-summary.md)
- [docs/partner-eval/overview.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)
- [wiki/What-is-TrustSignal.md](/Users/christopher/Projects/trustsignal/wiki/What-is-TrustSignal.md)
