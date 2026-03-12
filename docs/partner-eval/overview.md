# TrustSignal Partner Evaluation Overview

## Problem

Teams often have a workflow record that says an artifact was reviewed, approved, or submitted, but they cannot easily prove later that the same artifact is still the one tied to that decision. In high-loss and highly scrutinized workflows, that creates an attack surface around tampered evidence, provenance loss, artifact substitution, and stale evidence in later review paths.

## Verification Lifecycle

The canonical lifecycle diagram and trust-boundary diagram are documented in [../verification-lifecycle.md](/Users/christopher/Projects/trustsignal/docs/verification-lifecycle.md).

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer for existing workflows by accepting a verification request, returning verification signals, issuing signed verification receipts, and supporting later verification during audit review.

TrustSignal is designed to support:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification without replacing the upstream workflow owner

## Demo

Start with the local developer trial when you want the shortest path to the verification lifecycle:

- [5-minute developer trial](/Users/christopher/Projects/trustsignal/demo/README.md)
- [Evaluator start here](/Users/christopher/Projects/trustsignal/docs/partner-eval/start-here.md)
- [Try the API](/Users/christopher/Projects/trustsignal/docs/partner-eval/try-the-api.md)

## Integration Model

Start with these evaluator assets:

- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [Postman collection](/Users/christopher/Projects/trustsignal/postman/TrustSignal.postman_collection.json)

The evaluator flow is designed to show the verification lifecycle safely before production integration requirements are introduced.

## Technical Details

The public evaluation path in this repository is the `/api/v1/*` surface:

1. Submit a verification request to `POST /api/v1/verify`.
2. Receive a decision, signed verification receipt, and provenance metadata.
3. Retrieve the stored receipt at `GET /api/v1/receipt/{receiptId}`.
4. Run later verification at `POST /api/v1/receipt/{receiptId}/verify`.
5. Use authorized lifecycle actions such as revocation and provenance-state retrieval where needed.

Canonical contract and payload examples live in [openapi.yaml](/Users/christopher/Projects/trustsignal/openapi.yaml) and the [`examples/`](../../examples) directory.

## Integration Fit

TrustSignal fits behind an existing workflow such as:

- a partner portal
- a compliance evidence pipeline
- a deed or property-record workflow
- another intake system that already owns collection and review

The upstream platform remains the system of record. TrustSignal adds an integrity layer and returns technical verification artifacts that can be stored alongside the workflow record.

## Production Deployment Requirements

Local and evaluator paths are deliberate evaluator paths. Production deployment requires explicit authentication, signing configuration, and environment setup. Fail-closed defaults are part of the security posture and are intended to stop unsafe production assumptions from being applied implicitly.
