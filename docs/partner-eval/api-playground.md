# TrustSignal API Playground

## Problem

Evaluators often want a single page that shows the public API lifecycle, the exact artifacts to use, and the smallest realistic set of commands for testing.

## Integrity Model

TrustSignal provides verification signals, signed verification receipts, verifiable provenance metadata, and later verification through the public `/api/v1/*` surface.

## Integration Fit

Use this playground when you want to test the golden path quickly:

1. submit a verification request
2. receive verification signals plus a signed verification receipt
3. retrieve the stored receipt
4. run later verification

Canonical assets:

- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [verification-request.json](/Users/christopher/Projects/trustsignal/examples/verification-request.json)
- [verification-response.json](/Users/christopher/Projects/trustsignal/examples/verification-response.json)
- [verification-receipt.json](/Users/christopher/Projects/trustsignal/examples/verification-receipt.json)
- [verification-status.json](/Users/christopher/Projects/trustsignal/examples/verification-status.json)
- [TrustSignal.postman_collection.json](/Users/christopher/Projects/trustsignal/postman/TrustSignal.postman_collection.json)

## Technical Detail

### Environment

```bash
export TRUSTSIGNAL_BASE_URL="http://localhost:3001"
export TRUSTSIGNAL_API_KEY="replace-with-api-key"
export RECEIPT_ID="replace-after-verify"
```

### Golden Path Diagram

```mermaid
flowchart LR
  A[Verification Request] --> B[POST /api/v1/verify]
  B --> C[Verification Signals + Signed Verification Receipt]
  C --> D[GET /api/v1/receipt/{receiptId}]
  C --> E[POST /api/v1/receipt/{receiptId}/verify]
```

### Verify

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/verify" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY" \
  --data @examples/verification-request.json
```

Expected response example:

```json
{
  "receiptVersion": "2.0",
  "decision": "ALLOW",
  "reasons": ["receipt issued"],
  "receiptId": "2c17d2f5-4de6-48c3-b22c-0b7ea9eb5c0a",
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

### Retrieve The Receipt

```bash
curl "$TRUSTSIGNAL_BASE_URL/api/v1/receipt/$RECEIPT_ID" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

### Run Later Verification

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/receipt/$RECEIPT_ID/verify" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

### Review Revocation Or Provenance State

If your evaluation includes lifecycle review:

```bash
curl -X POST "$TRUSTSIGNAL_BASE_URL/api/v1/anchor/$RECEIPT_ID" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

Revocation is also public, but it requires issuer authorization headers in addition to the API key. Use the Postman collection if you want the full request template.

## Evaluator Notes

Focus the evaluation on:

- whether the API returns verification signals you can store in an existing workflow
- whether signed verification receipts are easy to retrieve later
- whether later verification is explicit and easy to re-run
- whether the public contract exposes verifiable provenance without exposing internal implementation details

## Claims Boundary

This playground is for public API evaluation. It does not claim legal determinations, compliance certification, fraud adjudication, or replacement of the upstream system of record.
