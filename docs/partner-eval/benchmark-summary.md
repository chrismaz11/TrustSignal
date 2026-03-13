# TrustSignal Evaluator Benchmark Summary

> TrustSignal is evidence integrity infrastructure for signed verification receipts and later verification.

Short description:
This evaluator-facing brief summarizes the latest local TrustSignal benchmark snapshot, scenario coverage, benchmark metadata, and the right way to interpret the numbers.

Audience:
- partner evaluators
- technical sponsors
- developers validating benchmark artifacts

This page summarizes the most recent local evaluator benchmark snapshot from [bench/results/latest.json](/Users/christopher/Projects/trustsignal/bench/results/latest.json) and [bench/results/latest.md](/Users/christopher/Projects/trustsignal/bench/results/latest.md).

## Executive Summary

The current local evaluator run shows that the public `/api/v1/*` lifecycle is fast and stable in a reproducible local setup. Clean verification, receipt lookup, later verification, and repeated submissions all completed successfully across the sampled runs, with clean verification averaging `5.24 ms`, receipt lookup `0.57 ms`, and later verification `0.77 ms`.

The tampered artifact path also completed successfully across all sampled runs, with a median of `5.13 ms`. Its `42.82 ms` p95 is materially higher than the median and should be treated as a follow-up item rather than a normal steady-state expectation. The current evidence suggests local first-run or parser-path variance, not a correctness failure, but the spread is large enough to call out explicitly.

## Key Facts / Scope

- Scope: current local evaluator benchmark run against the public `/api/v1/*` lifecycle
- Primary sample size: `15` iterations per applicable scenario
- Sequential batch size: `10`
- Raw artifacts: [latest.json](/Users/christopher/Projects/trustsignal/bench/results/latest.json), [latest.md](/Users/christopher/Projects/trustsignal/bench/results/latest.md)
- Integrity layer focus: signed verification receipts, verification signals, verifiable provenance, later verification, and existing workflow integration

## Main Content

### Metric Table

| Metric | Samples | Min (ms) | Max (ms) | Mean (ms) | Median (ms) | p95 (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Verification request latency | 15 | 3.21 | 21.65 | 5.24 | 4.11 | 21.65 |
| Signed receipt generation latency | 15 | 0.27 | 0.63 | 0.34 | 0.32 | 0.63 |
| Receipt lookup latency | 15 | 0.51 | 0.63 | 0.57 | 0.56 | 0.63 |
| Later verification latency | 15 | 0.67 | 1.08 | 0.77 | 0.71 | 1.08 |
| Tampered artifact detection latency | 15 | 4.74 | 42.82 | 7.76 | 5.13 | 42.82 |
| Repeated-run stability latency | 15 | 3.03 | 3.69 | 3.24 | 3.16 | 3.69 |

### Scenario Coverage

- `clean`: end-to-end `POST /api/v1/verify` with signed receipt issuance
- `tampered`: declared-hash vs observed-digest mismatch path
- `repeat`: repeated verification of the same artifact payload
- `lookup`: `GET /api/v1/receipt/:receiptId`
- `later-verification`: `POST /api/v1/receipt/:receiptId/verify`
- `bad-auth`: missing or invalid `x-api-key`
- `malformed`: missing or malformed request payload
- `dependency-failure`: safe fail-closed registry-screening path
- `batch`: short sequential batch run

Reliability notes from the latest run:

- `15/15` clean verification requests returned signed receipts.
- `15/15` tampered runs surfaced a declared-hash vs observed-digest mismatch.
- `15/15` later verification requests returned `verified=true`.
- `10/10` sequential batch requests returned `HTTP 200`.

### Environment And Caveats

- Benchmark timestamp: `2026-03-12T22:30:04.260Z`
- Runtime: Node `v22.14.0`
- Platform: `darwin (arm64)`
- Database: temporary local PostgreSQL instance on `127.0.0.1:64030`
- Primary sample size: `15` iterations per applicable scenario
- Sequential batch sample size: `10`
- Harness command: `npx tsx bench/run-bench.ts --scenario all --runs 15 --batch-size 10`

Current caveats:

- This is a local developer-workstation benchmark, not a hosted environment benchmark.
- The harness uses Fastify injection to exercise the public evaluator routes without adding external network-hop latency.
- The tampered scenario uses a local byte fixture to force a declared-hash mismatch. It is useful for evaluator behavior checks, not for claiming document-parser completeness.

### How To Interpret These Numbers

Treat these values as recent local evaluator benchmark results. They are useful for comparing request classes, spotting regressions, and demonstrating lifecycle behavior, but they are not production SLA claims and should not be read as guaranteed deployment latency.

The medians are the best quick read for typical local behavior. The p95 values are more useful for spotting variance and warm-up effects. In this run, the tampered-path p95 spike is large enough to watch in future snapshots.

### What The Benchmark Does Measure

- Public evaluator lifecycle timing for the current `/api/v1/*` verification path
- Signed receipt issuance timing using the same receipt-building and signing primitives used by the evaluator flow
- Receipt retrieval and later verification timing
- Repeatability across multiple local runs
- API-boundary failure behavior for bad auth and malformed payloads
- A safe local fail-closed dependency scenario

### What The Benchmark Does Not Measure

- Production network latency, cold starts behind hosting infrastructure, or edge routing effects
- Multi-tenant concurrency, sustained throughput, or horizontal scaling behavior
- Remote database latency, failover behavior, or managed-service variance
- Full end-user browser timing
- Proof internals, signer infrastructure specifics, internal topology, or any non-public runtime surfaces

### Tampered Path Variance Review

The tampered artifact path recorded a median of `5.13 ms` but a p95 of `42.82 ms`. Given the local fixture-driven setup and the parser/compliance code touched by that path, this looks more like local path variance than an indication that tamper detection is unreliable. Even so, the spread is large enough that it should be treated as a follow-up item in future benchmark runs rather than dismissed as unimportant expected variance.

## Claims Boundary

> [!NOTE]
> Claims boundary: this brief describes local benchmark behavior for the public TrustSignal integration surface. It should not be read as a production SLA, a claim about internal proof systems, or a statement about non-public infrastructure.

## Related Artifacts / References

- [docs/partner-eval/overview.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)
- [docs/partner-eval/try-the-api.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/try-the-api.md)
- [docs/partner-eval/security-summary.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/security-summary.md)
- [bench/README.md](/Users/christopher/Projects/trustsignal/bench/README.md)
