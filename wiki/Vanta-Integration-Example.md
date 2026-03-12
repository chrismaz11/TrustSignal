**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# Vanta Integration Example

TrustSignal can produce a normalized evidence payload for Vanta-oriented workflows. The goal is to make a verification event portable into a control-evidence system without requiring the downstream system to understand TrustSignal-specific receipt structure.

## Relevant Endpoints

- `POST /api/v1/verify`
- `GET /api/v1/integrations/vanta/schema`
- `GET /api/v1/integrations/vanta/verification/:receiptId`

## Integration Flow

```mermaid
flowchart LR
  A[Partner Workflow] --> B[POST /api/v1/verify]
  B --> C[Signed Receipt]
  C --> D[GET /api/v1/integrations/vanta/verification/:receiptId]
  D --> E[Vanta Evidence Payload]
  E --> F[Vanta Control or Audit Workflow]
```

## Step by Step

1. Submit the verification request to `POST /api/v1/verify`.
2. Store the returned `receiptId`.
3. Optionally retrieve the schema from `GET /api/v1/integrations/vanta/schema`.
4. Request the normalized payload from `GET /api/v1/integrations/vanta/verification/:receiptId`.
5. Attach that JSON payload to the relevant Vanta evidence workflow.

## Auth Model

- `POST /api/v1/verify` requires `x-api-key` with `verify`
- `GET /api/v1/integrations/vanta/schema` requires `x-api-key` with `read`
- `GET /api/v1/integrations/vanta/verification/:receiptId` requires `x-api-key` with `read`

## Payload Shape

The Vanta payload uses schema version `trustsignal.vanta.verification_result.v1` and includes:

- `vendor` metadata
- `subject` metadata such as `receiptId` and `receiptHash`
- `result` fields such as decision, normalized status, reasons, checks, and risk summary
- `controls` fields such as revocation state, anchor state, and signature presence

## Why Use the Vanta View

The Vanta view is useful when a downstream system needs a stable evidence payload instead of the full receipt object. It reduces field-mapping ambiguity and gives partner teams a predictable schema for control evidence ingestion.

## Claims Boundary

The Vanta payload is evidence of a technical verification event. It should not be described as a compliance certification or a substitute for control testing performed in the destination system.
