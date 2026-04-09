**Navigation**

- [Home](Home.md)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# What Is TrustSignal

## Problem

Many workflow systems can show that an artifact was collected or reviewed. Fewer can later verify that the same artifact is still the one tied to the recorded decision. In high-stakes workflows, that creates attack surfaces around evidence tampering after collection, artifact substitution attacks, provenance loss in compliance workflows, stale evidence during audit review, and unverifiable documentation chains.

High-loss environments create incentives for those attack paths because the challenge usually appears during downstream review, not at the original moment of collection.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification for existing workflows.

## Demo

The fastest local evaluator path is the 5-minute developer trial:

- [5-minute developer trial](../demo/README.md)

## Integration

The evaluator and demo path in this repository is a deliberate evaluator path. It is designed to show the verification lifecycle safely before production integration requirements are fully configured.

## Integration Fit

TrustSignal fits behind an existing platform such as:

- a compliance operations system
- an evidence collection workflow
- a partner portal
- a vertical workflow such as deed verification

The upstream platform remains the system of record. TrustSignal adds an integrity layer at the workflow boundary.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Technical Details

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
