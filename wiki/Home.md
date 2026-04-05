**Navigation**

- [Home](Home.md)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# TrustSignal Wiki

TrustSignal is evidence integrity infrastructure for existing workflows. It acts as an integrity layer that provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability.

## Problem

TrustSignal is built for workflows where evidence can be challenged after collection. The relevant attack surface includes evidence tampering after collection, artifact substitution attacks, provenance loss across compliance workflows, stale evidence during audit review, and documentation chains that cannot be verified later.

High-loss environments create incentives for these attack paths because downstream reviewers often must rely on artifacts long after the original collection event.

## Verification Lifecycle

The canonical lifecycle diagram is documented in [docs/verification-lifecycle.md](../docs/verification-lifecycle.md).

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability as an integrity layer for an existing system of record.

## Start Here

- [What is TrustSignal](What-is-TrustSignal.md)
- [API Overview](API-Overview.md)
- [Verification Receipts](Verification-Receipts.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)

## Demo

- [5-minute developer trial](../demo/README.md)

## Integration Model

Use the evaluator docs when you want to see the verification lifecycle before production integration detail:

- [Evaluator quickstart](../docs/partner-eval/quickstart.md)
- [API playground](../docs/partner-eval/api-playground.md)
- [OpenAPI contract](../openapi.yaml)

## Technical Details

The public verification lifecycle is:

1. submit a verification request
2. receive verification signals and a signed verification receipt
3. store the receipt with the workflow record
4. run later verification before downstream reliance
5. use authorized lifecycle actions when receipt state changes

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Current Boundary

TrustSignal provides technical verification artifacts. It does not provide legal determinations, compliance certification, fraud adjudication, or a replacement for the upstream system of record.
