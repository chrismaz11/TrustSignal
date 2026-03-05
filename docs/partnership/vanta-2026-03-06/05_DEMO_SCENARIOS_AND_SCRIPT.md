# Demo Scenarios and Technical Script

## Demo Goal

Show that a Vanta user can trigger verification, receive status, and ingest cryptographic receipt evidence without leaving the Vanta workflow.

Target performance statement for demo:
- "Typical verification response in pilot profile is around 2 seconds for synthetic inputs."

## Scenario 1: Real Estate Onboarding

- Context: Fintech lender onboarding a title/deed package.
- Request: `documentType=property_deed`, `policyProfile=STANDARD_IL`.
- Expected output: `normalizedStatus=PASS` with receipt and optional anchor data.

## Scenario 2: Healthcare Vendor Credentialing

- Context: Hospital verifies provider license before vendor activation.
- Request: `documentType=medical_license`, `policyProfile=HEALTHCARE_US`.
- Expected output: policy check list + immutable receipt hash for audit evidence.

## Scenario 3: Legal Notarization Evidence

- Context: Legal operations verifies notarization metadata before contract close.
- Request: `documentType=notary_certificate`, `policyProfile=LEGAL_US`.
- Expected output: `normalizedStatus=REVIEW` or `PASS`, with reason codes.

## Scenario 4: Vendor Due Diligence

- Context: Security/compliance team validates business license and COI metadata.
- Request: `documentType=business_license`, `policyProfile=VENDOR_DUE_DILIGENCE`.
- Expected output: actionable result + evidence payload for Vanta control mapping.

## Technical Demo Sequence (Live)

1. Open mock Vanta dashboard (`apps/api/public/demo/vanta-partner-demo.html`).
2. Submit verification request via `POST /partner/v1/verify/document` (or mapped staging endpoint).
3. Display returned `verificationId` and immediate `PENDING` state.
4. Poll status endpoint until `COMPLETE`.
5. Retrieve receipt and show:
   - receipt hash
   - ZK attestation metadata
   - anchor status/tx hash
6. Show webhook payload emitted to Vanta endpoint (recorded in console or mock sink).
7. Close with evidence mapping in Vanta control workflow.

## CLI Demo Commands

```bash
# terminal 1: webhook sink
node scripts/mock-vanta-webhook-listener.mjs

# terminal 2: verification + webhook delivery
TRUSTSIGNAL_BASE_URL=http://localhost:8080 \
TRUSTSIGNAL_API_KEY=<api-key> \
VANTA_CALLBACK_URL=http://localhost:8787/webhooks/trustsignal \
TRUSTSIGNAL_WEBHOOK_SECRET=demo-webhook-secret \
node scripts/vanta-partner-demo.mjs
```

## Demo Talk Track (Short)

- "Vanta remains the compliance operating layer."
- "TrustSignal adds proof-grade document authenticity."
- "We exchange commitments, checks, and receipts, not raw documents in the evidence contract."
- "This gives your customers stronger audit trails with minimal workflow change."

## Sample Mock Inputs

Stored under:
- `docs/partnership/vanta-2026-03-06/samples/real-estate-request.json`
- `docs/partnership/vanta-2026-03-06/samples/healthcare-request.json`
- `docs/partnership/vanta-2026-03-06/samples/legal-request.json`
