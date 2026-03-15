# Vanta Integration Use Case (Pilot)

Last updated: 2026-03-05  
Use case type: Pilot integration (reference workflow; participant identity withheld under NDA)

## Goal

Provide Vanta-ingestable verification evidence from TrustSignal for document-level control checks.

## Reference Pilot Scenario

- Vertical: Property deed verification (TrustSignal module)
- Workflow: Partner submits a verification bundle, receives receipt, and forwards normalized verification output to Vanta evidence workflows.
- Data mode: Pilot-safe/synthetic where required by policy and agreement.

## Integration Endpoint Contract

- Schema endpoint:
  - `GET /api/v1/integrations/vanta/schema`
- Structured result endpoint:
  - `GET /api/v1/integrations/vanta/verification/:receiptId`
- Auth:
  - `x-api-key` with `read` scope

## Result Schema Version

- `trustsignal.vanta.verification_result.v1`

## Example Integration Flow

1. Call `POST /api/v1/verify` to create a verification receipt.
2. Extract `receiptId` from response.
3. Call `GET /api/v1/integrations/vanta/verification/:receiptId`.
4. Store response JSON as evidence payload in Vanta control workflow.

## Example Payload (Abbreviated)

```json
{
  "schemaVersion": "trustsignal.vanta.verification_result.v1",
  "generatedAt": "2026-03-05T15:00:00.000Z",
  "vendor": {
    "name": "TrustSignal",
    "module": "TrustSignal",
    "environment": "production",
    "apiVersion": "v1"
  },
  "subject": {
    "receiptId": "abc123",
    "receiptHash": "0x...",
    "policyProfile": "STANDARD_IL",
    "createdAt": "2026-03-05T14:59:00.000Z"
  },
  "result": {
    "decision": "ALLOW",
    "normalizedStatus": "PASS",
    "riskScore": 12,
    "reasons": [],
    "checks": [],
    "fraudRisk": null,
    "zkpAttestation": {
      "scheme": "GROTH16-MOCK-v1"
    }
  },
  "controls": {
    "revoked": false,
    "anchorStatus": "PENDING",
    "anchored": false
  }
}
```

## Acceptance Criteria

- Endpoint is reachable in deployed environment.
- Response validates against declared schema.
- Pilot partner can ingest payload into Vanta workflow without field mapping ambiguity.

## Evidence to Attach

- Endpoint probe logs/screenshots (staging and production as applicable)
- Sample payload and schema snapshot
- Integration run log with timestamp and environment

## Automation

Use:

```bash
scripts/capture-vanta-integration-evidence.sh <base-url> <api-key-with-verify-and-read-scope>
```

Default output path:
- `docs/evidence/staging/vanta-integration-<timestamp>.md`
