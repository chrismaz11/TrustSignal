**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# FAQ

## Is TrustSignal a workflow replacement?

No. TrustSignal is an integrity layer that fits behind an existing workflow or system of record.

## What is the main product output?

The main output is a signed verification receipt that can be retrieved, checked, and attached to downstream audit or compliance workflows.

## Which API should new integrations use?

For receipt-oriented integrations in this repository, prefer the `/api/v1/*` surface. The `/v1/*` surface remains available and is used by the current JavaScript SDK.

## Does TrustSignal provide a JavaScript SDK?

Yes. The repository includes `@trustsignal/sdk`, which currently targets the `/v1/*` API surface.

## Can TrustSignal support Vanta evidence workflows?

Yes. The repository exposes a Vanta schema endpoint and a normalized verification-result endpoint for Vanta-style evidence ingestion.

## Can receipts be revoked or anchored through the public API?

Yes. Receipt lifecycle routes include revocation and anchoring operations, subject to the documented authorization model and receipt state requirements.

## Does TrustSignal make legal or compliance determinations?

No. TrustSignal provides technical verification signals. It should not be described as legal advice, a certification, or a substitute for independent control validation.

## Does the public documentation include engine internals?

No. Public-facing documentation should describe outcomes, integration points, and security boundaries without exposing private implementation details.

## What should integrators store?

At minimum, store the `receiptId` and `receiptHash` returned by TrustSignal so the receipt can be retrieved and re-checked later.

## Should raw PII be exposed or anchored through TrustSignal by default?

No. Public integrations should minimize sensitive data exposure and avoid anchoring raw personal data unless there is an explicit requirement and supporting controls.

## Does TrustSignal replace the upstream evidence source?

No. The upstream platform remains the system of record. TrustSignal adds verifiable provenance around the verification event.
