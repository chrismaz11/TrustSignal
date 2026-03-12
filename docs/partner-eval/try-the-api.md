# Try The TrustSignal API

This page is the copy-paste API trial path for the public evaluator contract.

## 1. Submit A Verification Request

Request body: [verification-request.json](/Users/christopher/Projects/trustsignal/examples/verification-request.json)

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/verify" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY" \
  --data @examples/verification-request.json
```

Sample response: [verification-response.json](/Users/christopher/Projects/trustsignal/examples/verification-response.json)

```json
{
  "receiptVersion": "2.0",
  "decision": "ALLOW",
  "reasons": ["receipt issued"],
  "receiptId": "623e0b54-87b3-42b7-bc89-65fae0ad8d5e",
  "receiptHash": "0x4e7f2ce9d3f7a8d3b0e4c9f2aa17fd59d6b4fda2d7b7b7d1cce8124d7ee39d04",
  "receiptSignature": {
    "alg": "EdDSA",
    "kid": "trustsignal-current",
    "signature": "eyJleGFtcGxlIjoic2lnbmVkLXJlY2VpcHQifQ"
  },
  "anchor": {
    "status": "PENDING",
    "subjectDigest": "0x8c0f95cda31274e7b61adfd1dd1e0c03a4b96f78d90da52d42fd93d9a38fc112",
    "subjectVersion": "trustsignal.anchor_subject.v1"
  },
  "revocation": {
    "status": "ACTIVE"
  }
}
```

## 2. Retrieve The Stored Receipt

Receipt example: [verification-receipt.json](/Users/christopher/Projects/trustsignal/examples/verification-receipt.json)

```bash
curl "$TRUSTSIGNAL_BASE_URL/api/v1/receipt/$RECEIPT_ID" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

## 3. Run Later Verification

Status example: [verification-status.json](/Users/christopher/Projects/trustsignal/examples/verification-status.json)

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/receipt/$RECEIPT_ID/verify" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

## 4. Optional Public Lifecycle Actions

If your evaluation includes provenance-state review:

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/anchor/$RECEIPT_ID" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

Revocation is part of the public contract, but it requires issuer authorization headers in addition to the API key. Use the Postman collection for the full request template.

## Recent Verification Timing

Recent local benchmark snapshot from [bench/results/latest.md](/Users/christopher/Projects/trustsignal/bench/results/latest.md) at `2026-03-12T22:30:04.260Z`. For a fuller evaluator-facing summary, see [benchmark-summary.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/benchmark-summary.md).

- `POST /api/v1/verify` clean-path latency: mean `5.24 ms`, median `4.11 ms`, p95 `21.65 ms`
- signed receipt generation latency: mean `0.34 ms`, median `0.32 ms`, p95 `0.63 ms`
- `GET /api/v1/receipt/:receiptId` lookup latency: mean `0.57 ms`, median `0.56 ms`, p95 `0.63 ms`
- `POST /api/v1/receipt/:receiptId/verify` later verification latency: mean `0.77 ms`, median `0.71 ms`, p95 `1.08 ms`
- tampered artifact detection path: mean `7.76 ms`, median `5.13 ms`, p95 `42.82 ms`

These numbers come from a recent local benchmark harness run against the current evaluator path. They are current validation data, not guaranteed service latency.

## Production Readiness

- Authentication: use `x-api-key` with the scopes required for verify, read, anchor, or revoke operations.
- Environment configuration: separate local, staging, and production base URLs, API keys, and lifecycle identifiers.
- Lifecycle monitoring: monitor receipt retrieval, lifecycle state changes, and later verification outcomes in the surrounding workflow.
- Verification checks before relying on prior results: run later verification before audit review, handoff, or another high-trust workflow step.
