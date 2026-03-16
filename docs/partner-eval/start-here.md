# TrustSignal Evaluator Start Here

This is the canonical evaluator entry point for partner engineers reviewing TrustSignal.

## 1. What TrustSignal Does

TrustSignal is evidence integrity infrastructure for existing workflow integration. It acts as an integrity layer that returns signed verification receipts, verification signals, verifiable provenance, and later verification capability without replacing the system of record.

TrustSignal provides:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification capability

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- replacement for the system of record

## 2. The Verification Lifecycle

Start with the canonical lifecycle and trust-boundary diagrams in [verification-lifecycle.md](../verification-lifecycle.md).

The public lifecycle is:

1. submit a verification request
2. receive verification signals and a signed verification receipt
3. store the receipt with the workflow record
4. run later verification before downstream reliance
5. detect tampering, substitution, or provenance drift through later verification

## 3. What You Can Evaluate In 5 Minutes

Use the local evaluator and public API artifacts to confirm:

- whether the public API returns verification signals you can store in an existing workflow
- whether signed verification receipts are easy to retrieve and inspect
- whether later verification is explicit and easy to re-run during audit review
- whether the contract exposes verifiable provenance without exposing internal implementation details

Start here:

- [overview.md](overview.md)
- [try-the-api.md](try-the-api.md)
- [demo/README.md](../../demo/README.md)

## 4. Public API Contract

- [openapi.yaml](../../openapi.yaml)
- [TrustSignal.postman_collection.json](../../postman/TrustSignal.postman_collection.json)
- [TrustSignal.local.postman_environment.json](../../postman/TrustSignal.local.postman_environment.json)

The public evaluator path uses the existing `/api/v1/*` contract only.

## 5. Example Payloads

- [examples/verification-request.json](../../examples/verification-request.json)
- [examples/verification-response.json](../../examples/verification-response.json)
- [examples/verification-receipt.json](../../examples/verification-receipt.json)
- [examples/verification-status.json](../../examples/verification-status.json)

## 6. Security / Claims Boundary

- [security-summary.md](security-summary.md)
- [claims-boundary.md](claims-boundary.md)

Public evaluator materials intentionally do not expose proof internals, circuit identifiers, model outputs, signing infrastructure specifics, internal service topology, witness or prover details, or registry scoring algorithms.

## 7. Where To Go Next

- [integration-model.md](integration-model.md)
- [api-playground.md](api-playground.md)
- [quickstart.md](quickstart.md)
