# TrustSignal Benchmark Snapshot

## Test Date/Time
- 2026-03-12T22:22:06.846Z

## Environment Description
- Node: v22.14.0
- Platform: darwin (arm64)
- Host: Christophers-Mac-mini.local
- Temp database: postgresql on 127.0.0.1:63688
- Harness command: `npx tsx bench/run-bench.ts --scenario all --runs 15 --batch-size 10`

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
| clean | 15 | 3.19 | 19.57 | 5.06 | 3.78 | 19.57 | 15/15 |
| tampered | 15 | 4.69 | 42.84 | 8.02 | 5.01 | 42.84 | 15/15 |
| repeat | 15 | 3 | 4.04 | 3.24 | 3.21 | 4.04 | 15/15 |
| lookup | 15 | 0.56 | 0.71 | 0.6 | 0.57 | 0.71 | 15/15 |
| later-verification | 15 | 0.7 | 1.07 | 0.76 | 0.72 | 1.07 | 15/15 |
| bad-auth | 2 | 0.15 | 0.23 | 0.19 | 0.19 | 0.23 | 2/2 |
| malformed | 2 | 0.39 | 0.46 | 0.43 | 0.43 | 0.46 | 2/2 |
| dependency-failure | 1 | 13.35 | 13.35 | 13.35 | 13.35 | 13.35 | 1/1 |
| batch | 10 | 3.07 | 3.57 | 3.24 | 3.22 | 3.57 | 10/10 |

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
