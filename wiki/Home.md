**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# TrustSignal Wiki

Short description:
This wiki is the lightweight TrustSignal knowledge map for core concepts, API orientation, claims boundary, and quick evaluator references.

Audience:
- evaluators
- developers
- partner reviewers

TrustSignal is evidence integrity infrastructure for existing workflows. It acts as an integrity layer that provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability.

## Start Here

- [What is TrustSignal](What-is-TrustSignal.md)
- [API Overview](API-Overview.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Claims Boundary](Claims-Boundary.md)

## Problem / Context

TrustSignal is built for workflows where evidence can be challenged after collection. The relevant attack surface includes evidence tampering after collection, artifact substitution attacks, provenance loss across compliance workflows, stale evidence during audit review, and documentation chains that cannot be verified later.

High-loss environments create incentives for these attack paths because downstream reviewers often must rely on artifacts long after the original collection event.

## Integrity Model

The canonical lifecycle diagram is documented in [docs/verification-lifecycle.md](/Users/christopher/Projects/trustsignal/docs/verification-lifecycle.md).

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability as an integrity layer for an existing system of record.

## How It Works

TrustSignal provides:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration

## Demo

- [5-minute developer trial](/Users/christopher/Projects/trustsignal/demo/README.md)

## API And Examples

Use the evaluator docs when you want to see the verification lifecycle before production integration detail:

- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)

## Verification Lifecycle

The public verification lifecycle is:

1. submit a verification request
2. receive verification signals and a signed verification receipt
3. store the receipt with the workflow record
4. run later verification before downstream reliance
5. use authorized lifecycle actions when receipt state changes

## Production Considerations

> [!IMPORTANT]
> Production considerations: the wiki mirrors the public evaluation surface. It does not replace deployment-specific authentication, signing configuration, infrastructure controls, or operational review.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Security And Claims Boundary

TrustSignal provides technical verification artifacts. It does not provide legal determinations, compliance certification, fraud adjudication, or a replacement for the upstream system of record.

## Related Documentation

- [docs/README.md](/Users/christopher/Projects/trustsignal/docs/README.md)
- [docs/partner-eval/overview.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)
- [docs/verification-lifecycle.md](/Users/christopher/Projects/trustsignal/docs/verification-lifecycle.md)
- [wiki/Claims-Boundary.md](/Users/christopher/Projects/trustsignal/wiki/Claims-Boundary.md)
