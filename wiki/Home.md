**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# TrustSignal Wiki

TrustSignal is evidence integrity infrastructure for existing workflows. It acts as an integrity layer that provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability.

## Problem

TrustSignal is built for workflows where evidence can be challenged after collection. The relevant attack surface includes evidence tampering after collection, artifact substitution attacks, provenance loss across compliance workflows, stale evidence during audit review, and documentation chains that cannot be verified later.

High-loss environments create incentives for these attack paths because downstream reviewers often must rely on artifacts long after the original collection event.

## Integrity Model

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability as an integrity layer for an existing system of record.

## Start Here

- [What is TrustSignal](What-is-TrustSignal)
- [API Overview](API-Overview)
- [Verification Receipts](Verification-Receipts)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)

## Demo

- [5-minute developer trial](/Users/christopher/Projects/trustsignal/demo/README.md)

## Integration

Use the evaluator docs when you want to see the verification lifecycle before production integration detail:

- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)

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
