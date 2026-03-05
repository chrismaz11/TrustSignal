# Partnership FAQ and Objection Handling

## 1) How is this different from DocuSign/Notarize?

- Those platforms focus on signing/notarization workflow execution.
- TrustSignal focuses on cryptographic verification outputs and audit-grade receipts that can be consumed by compliance systems.
- Positioning: complementary in many workflows, not strictly replacement.

## 2) Do you store raw customer documents?

- Integration contract is designed around commitments/hashes and verification evidence payloads.
- Receipt storage emphasizes commitment/hash + check outputs.
- Final data-retention terms should be contractually specified per customer and environment.

## 3) What if blockchain is slow?

- Verification decision path is decoupled from optional anchoring.
- Core decision and receipt generation can return without waiting on chain finality.
- Anchor status is exposed asynchronously (`PENDING` -> `ANCHORED`).

## 4) Is this SOC 2 compliant?

- Do not claim certification unless formally completed and audited.
- Current position: SOC 2 readiness and control mapping work is underway; share artifacts transparently.

## 5) What integration effort is required on Vanta's side?

- Minimal pilot path:
  - One API client in integration service
  - One webhook receiver
  - One evidence mapping template
- Typical integration can be completed in 2-4 weeks with dedicated owners.

## 6) How do retries and failures work?

- Client retries supported through idempotency keys and backoff guidance.
- Webhooks are at-least-once with signed event IDs for de-duplication.
- Status endpoint remains source of truth for eventual consistency.

## 7) What is the business model?

- Three options: referral, co-sell, or embedded/white-label.
- Start with a pilot and convert to usage-based annual agreement after KPI validation.

## 8) What should we ask from Vanta tomorrow?

- Confirm target customer workflows and urgency.
- Confirm technical owner and pilot scope.
- Confirm partnership motion preference (integration only vs GTM + product). 
