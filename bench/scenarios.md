# TrustSignal Scenario Matrix

## Clean Artifact Verification

- Purpose: Measure baseline evaluator latency for a clean artifact flowing through `POST /api/v1/verify`.
- Command or script path: `npx tsx bench/run-bench.ts --scenario clean --runs 15`
- Expected outcome: HTTP `200` with `receiptId`, `receiptHash`, and `receiptSignature`.
- Metric(s) captured: verification request latency, signed receipt generation latency.

## Tampered Artifact Verification

- Purpose: Measure how quickly the evaluator flow records a declared-hash vs observed-digest mismatch for tampered bytes.
- Command or script path: `npx tsx bench/run-bench.ts --scenario tampered --runs 15`
- Expected outcome: HTTP `200` with mismatch visible in `zkpAttestation.publicInputs.declaredDocHash` vs `documentDigest`.
- Metric(s) captured: tampered artifact detection latency.

## Repeated Verification Of Same Artifact

- Purpose: Measure stability when the same payload is submitted repeatedly through the public verification path.
- Command or script path: `npx tsx bench/run-bench.ts --scenario repeat --runs 15`
- Expected outcome: repeated HTTP `200` responses with signed receipts and no contract drift.
- Metric(s) captured: repeated-run stability, per-run latency spread.

## Receipt Retrieval / Status Check

- Purpose: Measure persisted receipt lookup and later verification latency after successful issuance.
- Command or script path: `npx tsx bench/run-bench.ts --scenario lookup --runs 15`
- Expected outcome: `GET /api/v1/receipt/:receiptId` returns HTTP `200`; `POST /api/v1/receipt/:receiptId/verify` returns HTTP `200` with `verified=true`.
- Metric(s) captured: status lookup latency, later verification latency.

## Bad Auth Or Missing Auth

- Purpose: Confirm evaluator-visible fail-closed behavior for missing or invalid API authentication.
- Command or script path: `npx tsx bench/run-bench.ts --scenario bad-auth`
- Expected outcome: missing auth returns HTTP `401`; invalid auth returns HTTP `403`.
- Metric(s) captured: auth failure response latency.

## Missing Or Malformed Payload

- Purpose: Confirm invalid evaluator payloads fail at the API boundary instead of entering the verification lifecycle.
- Command or script path: `npx tsx bench/run-bench.ts --scenario malformed`
- Expected outcome: HTTP `400` with invalid payload errors.
- Metric(s) captured: payload validation failure latency.

## Dependency Failure / Fail-Closed Behavior

- Purpose: Reproduce a safe dependency-failure path using registry screening without configured external access and verify the response does not silently pass as clean.
- Command or script path: `npx tsx bench/run-bench.ts --scenario dependency-failure`
- Expected outcome: HTTP `200` with a non-`ALLOW` decision that reflects compliance-gap or fail-closed handling.
- Metric(s) captured: dependency failure response latency.

## Small Batch Run

- Purpose: Measure short sequential batch behavior for evaluator-style repeated requests.
- Command or script path: `npx tsx bench/run-bench.ts --scenario batch --batch-size 10`
- Expected outcome: all sequential requests return HTTP `200` with signed receipts.
- Metric(s) captured: small batch latency distribution, success rate across the run.
