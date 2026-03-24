# TrustSignal Benchmark Harness

This harness measures the current public evaluator lifecycle without changing public endpoint names, SDK behavior, or core verification logic.

## What It Covers

- verification request latency via `POST /api/v1/verify`
- signed receipt generation latency using the same receipt build and signing primitives used by the evaluator flow
- receipt lookup latency via `GET /api/v1/receipt/:receiptId`
- later verification latency via `POST /api/v1/receipt/:receiptId/verify`
- tampered artifact detection latency during evaluator submission
- repeated-run stability for the same artifact payload
- evaluator-relevant negative cases such as bad auth, malformed payloads, and a safe dependency-failure path

## Run

```bash
npx tsx bench/run-bench.ts
```

Useful variants:

```bash
npx tsx bench/run-bench.ts --scenario clean --runs 15
npx tsx bench/run-bench.ts --scenario tampered --runs 15
npx tsx bench/run-bench.ts --scenario lookup --runs 15
npx tsx bench/run-bench.ts --scenario batch --batch-size 10
```

## Output

The harness writes:

- [latest.json](results/latest.json)
- [latest.md](results/latest.md)

The JSON contains raw timings plus aggregate metrics. The Markdown report is the public-safe evaluator summary for docs.

## Reproducibility Notes

- The harness starts a temporary local PostgreSQL instance and tears it down after the run.
- It targets the real local `/api/v1/*` evaluator routes through Fastify injection, so it exercises the same request validation, auth checks, persistence, receipt issuance, and later-verification logic used by the current evaluator path.
- It uses local fixture artifacts from [bench/fixtures](fixtures) to keep clean and tampered runs deterministic.
- Current metrics are local benchmark snapshots, not production guarantees.
