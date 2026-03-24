# TrustSignal Partner Evaluation Overview

> TrustSignal is evidence integrity infrastructure for signed verification receipts and later verification.

Short description:
This overview is the evaluator-facing entry point for the TrustSignal integrity layer, public lifecycle, benchmark materials, and existing workflow integration path.

Audience:
- partner evaluators
- solutions engineers
- technical sponsors

## Problem / Context

Teams often have a workflow record that says an artifact was reviewed, approved, or submitted, but they cannot easily prove later that the same artifact is still the one tied to that decision. In high-loss and highly scrutinized workflows, that creates an attack surface around tampered evidence, provenance loss, artifact substitution, and stale evidence in later review paths.

## Integrity Model

The canonical lifecycle diagram and trust-boundary diagram are documented in [../verification-lifecycle.md](../verification-lifecycle.md).

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer for existing workflows by accepting a verification request, returning verification signals, issuing signed verification receipts, and supporting later verification during audit review.

TrustSignal is designed to support:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification without replacing the upstream workflow owner

## How It Works

TrustSignal supports evaluator review through:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration through the public API boundary

## Demo

Start with the local developer trial when you want the shortest path to the verification lifecycle:

- [5-minute developer trial](../../demo/README.md)
- [Evaluator start here](start-here.md)
- [Try the API](try-the-api.md)

## Partner Evaluation

Start with these evaluator assets:

- [Evaluator quickstart](quickstart.md)
- [API playground](api-playground.md)
- [Benchmark summary](benchmark-summary.md)
- [OpenAPI contract](../../openapi.yaml)
- [Postman collection](../../postman/TrustSignal.postman_collection.json)

The evaluator flow is designed to show the verification lifecycle safely before production integration requirements are introduced.

## API And Examples

The public evaluation path in this repository is the `/api/v1/*` surface:

1. Submit a verification request to `POST /api/v1/verify`.
2. Receive a decision, signed verification receipt, and provenance metadata.
3. Retrieve the stored receipt at `GET /api/v1/receipt/{receiptId}`.
4. Run later verification at `POST /api/v1/receipt/{receiptId}/verify`.
5. Use authorized lifecycle actions such as revocation and provenance-state retrieval where needed.

Canonical contract and payload examples live in [openapi.yaml](../../openapi.yaml) and the [`examples/`](../../examples) directory.

## Benchmarks And Evaluator Materials

Recent local benchmark snapshot from [bench/results/latest.md](../../bench/results/latest.md) at `2026-03-12T22:30:04.260Z`. For evaluator-facing interpretation and caveats, see [benchmark-summary.md](benchmark-summary.md).

- clean verification request latency: mean `5.24 ms`, median `4.11 ms`, p95 `21.65 ms`
- signed receipt generation latency: mean `0.34 ms`, median `0.32 ms`, p95 `0.63 ms`
- receipt lookup latency: mean `0.57 ms`, median `0.56 ms`, p95 `0.63 ms`
- later verification latency: mean `0.77 ms`, median `0.71 ms`, p95 `1.08 ms`
- tampered artifact detection latency: mean `7.76 ms`, median `5.13 ms`, p95 `42.82 ms`
- repeated-run stability for the same artifact payload: mean `3.24 ms`, median `3.16 ms`, p95 `3.69 ms`

This snapshot comes from a recent local evaluator run. It is useful for comparing request classes and checking regressions, not for inferring guaranteed deployment latency.

## Production Considerations

> [!IMPORTANT]
> Production considerations: the evaluator path demonstrates the TrustSignal integrity layer before full deployment configuration. It does not replace deployment-specific authentication, signing configuration, or infrastructure review.

## Integration Fit

TrustSignal fits behind an existing workflow such as:

- a partner portal
- a compliance evidence pipeline
- a deed or property-record workflow
- another intake system that already owns collection and review

The upstream platform remains the system of record. TrustSignal adds an integrity layer and returns technical verification artifacts that can be stored alongside the workflow record.

## Security And Claims Boundary

> [!NOTE]
> Claims boundary: this overview covers the public evaluation surface only. It does not expose proof internals, circuit identifiers, model outputs, signing infrastructure specifics, or internal service topology.

## Production Deployment Requirements

Local and evaluator paths are deliberate evaluator paths. Production deployment requires explicit authentication, signing configuration, and environment setup. Fail-closed defaults are part of the security posture and are intended to stop unsafe production assumptions from being applied implicitly.

## Related Documentation

- [docs/partner-eval/try-the-api.md](try-the-api.md)
- [docs/partner-eval/benchmark-summary.md](benchmark-summary.md)
- [docs/partner-eval/security-summary.md](security-summary.md)
- [docs/verification-lifecycle.md](../verification-lifecycle.md)
