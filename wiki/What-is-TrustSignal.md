**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# What Is TrustSignal

## Problem

Many workflow systems can show that an artifact was collected or reviewed. Fewer can later verify that the same artifact is still the one tied to the recorded decision.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification for existing workflows.

## Integration Fit

TrustSignal fits behind an existing platform such as:

- a compliance operations system
- an evidence collection workflow
- a partner portal
- a vertical workflow such as deed verification

The upstream platform remains the system of record. TrustSignal adds an integrity layer at the workflow boundary.

## Technical Detail

At a high level, the public verification lifecycle is:

1. An upstream system submits a verification request.
2. TrustSignal evaluates the request against configured checks.
3. TrustSignal returns verification signals and a signed verification receipt.
4. Downstream systems store the receipt with the workflow record.
5. Later verification confirms receipt integrity, status, and provenance state when needed.

In the current codebase, the integration-facing `/api/v1/*` routes implement that lifecycle. The legacy `/v1/*` surface remains present for the current SDK.

## What TrustSignal Is Not

TrustSignal is not:

- a replacement for workflow software
- a legal decision engine
- a compliance certification service
- a fraud adjudication service
- a substitute for environment-specific security evidence
