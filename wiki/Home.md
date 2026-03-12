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

TrustSignal is built for workflows where evidence can be challenged after collection. The relevant attack surface includes tampered evidence, provenance loss, artifact substitution, and stale records that are difficult to verify later.

## Start Here

- [What is TrustSignal](What-is-TrustSignal)
- [API Overview](API-Overview)
- [Verification Receipts](Verification-Receipts)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)

## Evaluator Path

Use the evaluator docs when you want to see the verification lifecycle before production integration detail:

- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Current Boundary

TrustSignal provides technical verification artifacts. It does not provide legal determinations, compliance certification, fraud adjudication, or a replacement for the upstream system of record.
