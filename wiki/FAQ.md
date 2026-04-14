**Navigation**

- [Home](Home.md)
- [What is TrustSignal](What-is-TrustSignal.md)
- [Architecture](Evidence-Integrity-Architecture.md)
- [Verification Receipts](Verification-Receipts.md)
- [API Overview](API-Overview.md)
- [Claims Boundary](Claims-Boundary.md)
- [Quick Verification Example](Quick-Verification-Example.md)
- [Vanta Integration Example](Vanta-Integration-Example.md)

# FAQ

## Is TrustSignal a workflow replacement?

No. TrustSignal is an integrity layer that fits behind an existing workflow or system of record.

## What is the main product output?

The main output is a signed verification receipt that can be retrieved, checked, and attached to downstream audit or compliance workflows.

## Which API should new integrations use?

Use the `/api/v1/*` surface. The JavaScript SDK (`@trustsignal/sdk`) now covers this surface directly.

## Does TrustSignal provide a JavaScript SDK?

Yes. The repository includes `@trustsignal/sdk`, which targets the canonical `/api/v1/*` receipt lifecycle. See [SDK Usage](SDK-Usage.md) for examples.

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
