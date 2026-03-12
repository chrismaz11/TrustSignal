# TrustSignal Benchmark Snapshot

## Test Date/Time
- 2026-03-12T22:30:04.260Z

## Environment Description
- Node: v22.14.0
- Platform: darwin (arm64)
- Host: Christophers-Mac-mini.local
- Temp database: postgresql on 127.0.0.1:64030
- Harness command: `npx tsx bench/run-bench.ts --scenario all --runs 15 --batch-size 10`

## Iteration / Sample Notes
- Primary timing samples use 15 iterations per scenario when applicable.
- The sequential batch scenario uses 10 requests.
- First-run initialization effects may appear in max and p95 values, especially on scenarios that touch additional parsing or compliance paths.

## Environment Notes
- Local benchmark run on a developer workstation using a temporary PostgreSQL instance.
- The harness exercises the public /api/v1/* evaluator lifecycle through Fastify injection rather than an external network hop.
- No production load balancer, cross-service network latency, or remote datastore variance is included in these numbers.

## Scenarios Executed
- clean: Measure end-to-end clean artifact verification through POST /api/v1/verify.
- tampered: Measure latency for a tampered artifact submission where the declared hash does not match the supplied bytes.
- repeat: Measure stability when the same artifact payload is verified repeatedly.
- lookup: Measure receipt retrieval latency through GET /api/v1/receipt/:receiptId.
- later-verification: Measure later verification latency through POST /api/v1/receipt/:receiptId/verify.
- bad-auth: Confirm evaluator-visible fail-closed behavior for missing or invalid API authentication.
- malformed: Confirm malformed evaluator payloads fail early without entering the verification lifecycle.
- dependency-failure: Measure fail-closed behavior when an external registry dependency is unavailable without configured access.
- batch: Measure sequential small-batch behavior over a short evaluator run.

## Timing Summary Table

| Scenario | Count | Min (ms) | Max (ms) | Mean (ms) | Median (ms) | p95 (ms) | Success / Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| clean | 15 | 3.21 | 21.65 | 5.24 | 4.11 | 21.65 | 15/15 |
| tampered | 15 | 4.74 | 42.82 | 7.76 | 5.13 | 42.82 | 15/15 |
| repeat | 15 | 3.03 | 3.69 | 3.24 | 3.16 | 3.69 | 15/15 |
| lookup | 15 | 0.51 | 0.63 | 0.57 | 0.56 | 0.63 | 15/15 |
| later-verification | 15 | 0.67 | 1.08 | 0.77 | 0.71 | 1.08 | 15/15 |
| bad-auth | 2 | 0.15 | 0.24 | 0.2 | 0.2 | 0.24 | 2/2 |
| malformed | 2 | 0.37 | 0.48 | 0.42 | 0.42 | 0.48 | 2/2 |
| dependency-failure | 1 | 13.28 | 13.28 | 13.28 | 13.28 | 13.28 | 1/1 |
| batch | 10 | 3.09 | 3.79 | 3.26 | 3.15 | 3.79 | 10/10 |

## Reliability Notes
- clean: 15/15 clean verification requests returned signed receipts.
- tampered: 15/15 tampered runs surfaced a declared hash vs observed digest mismatch.
- repeat: 15/15 repeated submissions of the same payload returned HTTP 200.
- lookup: 15/15 receipt lookup requests returned the stored receipt.
- later-verification: 15/15 later verification requests returned verified=true.
- bad-auth: 2/2 auth-failure probes returned the expected 401 or 403 response.
- malformed: 2/2 malformed payload probes returned HTTP 400.
- dependency-failure: Registry dependency failure produced a non-ALLOW decision without exposing internal dependency details.
- batch: 10/10 batch requests returned HTTP 200.

## Notable Failures Or Caveats
- tampered: The tampered scenario uses a local byte fixture to force a declared-hash mismatch. It is suitable for evaluator behavior checks, not for asserting document-parser completeness.

## What This Means For Evaluators
- This is a recent local evaluator run against the current public `/api/v1/*` lifecycle, not a production SLA.
- The numbers are most useful for comparing request classes, verifying fail-closed behavior, and spotting regressions between local validation runs.
- Clean verification, receipt lookup, and later verification can be exercised repeatedly with signed-receipt persistence under a reproducible local database setup.
- Tampered and dependency-failure scenarios surface behavior signals that evaluators can test without exposing proof internals, signer infrastructure, or internal topology.
