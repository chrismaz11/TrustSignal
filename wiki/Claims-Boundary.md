**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# Claims Boundary

## Problem

Public integrations need a clear technical boundary so partner engineers and reviewers know what the TrustSignal response means and what it does not mean.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer for existing workflows and provides:

- signed verification receipts
- verification signals
- verifiable provenance metadata
- later verification capability
- API-accessible receipt lifecycle state

## Integration Fit

TrustSignal is designed to sit behind an upstream workflow that remains the system of record. The partner or workflow owner keeps control of collection, review, and business decisions.

## Technical Detail

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- a replacement for system-of-record workflows
- guarantees that depend on environment-specific infrastructure evidence outside this repository

The TrustSignal response should be treated as a technical verification artifact that supports audit-ready evidence and later verification.
