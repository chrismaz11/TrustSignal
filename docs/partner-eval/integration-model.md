# Partner Integration Model

## Problem

Most partner integrations already have an intake flow, case record, or evidence record. The missing layer is a stable verification artifact that can be retrieved and checked later.

## Integrity Model

TrustSignal accepts caller-supplied verification context and returns:

- a verification decision
- signed verification receipts
- verification signals for downstream workflow logic
- verifiable provenance metadata for later verification

## Integration Fit

A typical partner integration looks like this:

1. The partner system computes or supplies the artifact hash.
2. The partner posts the verification request to `POST /api/v1/verify`.
3. TrustSignal returns a signed verification receipt and verification signals.
4. The partner stores the `receiptId`, `receiptHash`, and decision with its own workflow record.
5. Before audit, handoff, or dispute review, the partner calls `POST /api/v1/receipt/{receiptId}/verify` for later verification.

## Request Inputs

The current public verification request includes these core fields:

- `bundleId`: caller-controlled verification identifier
- `transactionType`: workflow category
- `doc.docHash`: artifact hash
- `policy.profile`: policy or control identifier
- `property`: workflow-specific subject context for the current verification surface
- `timestamp`: caller-provided event time when available

## Response Outputs

The current public verification response includes these core fields:

- `decision`: verification signal
- `reasons`: human-readable response reasons
- `receiptId`: durable receipt handle
- `receiptHash`: digest for the receipt payload
- `receiptSignature`: signed receipt artifact
- `anchor.subjectDigest`: provenance digest when available
- `revocation.status`: current receipt lifecycle state

## Operational Notes

- Authentication is an `x-api-key` with scoped access.
- Receipt retrieval and later verification are separate read operations.
- Revocation is an authorized lifecycle action and requires issuer authorization headers in addition to the API key.
- TrustSignal is an existing workflow integration layer, not a replacement for the partner's system of record.
