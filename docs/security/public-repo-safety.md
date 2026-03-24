# Public Repo Safety

TrustSignal is a public repository. It is intended to expose the integration-facing verification surface, public-safe documentation, and example workflows for signed verification receipts.

## Intentionally Public

- public API contracts
- integration examples
- public-safe receipt lookup and summary responses
- generic verification lifecycle documentation
- placeholder environment examples

## Must Never Be Committed

- live secrets or tokens
- service-role or admin credentials
- database passwords or full connection strings
- signing private keys or raw key exports
- private evidence, private customer data, or raw production payloads

## Supabase Boundary

Supabase persistence is backend-only. Service-role credentials are used only by the TrustSignal API server and must never appear in browser code, GitHub Actions workflows, or public client examples.

The intended architecture is:

`Client or GitHub Action -> TrustSignal API -> Supabase`

## Public Verification Surface

Public receipt endpoints expose only safe receipt metadata needed for inspection:

- receipt identifier
- artifact hash and algorithm
- source metadata
- verification status
- issued timestamp
- safe receipt-signature metadata such as algorithm and key identifier

They do not expose signing key material, service-role credentials, private infrastructure details, or internal verification engine state.

## Private Material Stays Outside The Repo

Operational secrets, private evidence, full environment values, and internal infrastructure details must remain outside the public repository and outside public docs.
