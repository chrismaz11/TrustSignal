# Partner Security Summary

## Problem

Partners need enough security detail to evaluate the integration boundary without exposing internal implementation details that are not required for integration.

## Integrity Model

TrustSignal provides a public API boundary that is centered on signed verification receipts, verification signals, verifiable provenance metadata, and later verification.

## Integration Fit

For the public `/api/v1/*` surface in this repository:

- `x-api-key` authentication is required for partner operations.
- Keys are scope-bound to actions such as `verify`, `read`, `anchor`, and `revoke`.
- Request validation, rate limiting, and structured service logging are implemented at the API gateway.
- Receipt revocation requires additional issuer authorization headers.

## Technical Detail

TrustSignal does not require partners to understand internal proof systems, internal service topology, or signing infrastructure details in order to integrate.

For public evaluation, the important security properties are:

- signed verification receipts can be stored and checked later
- later verification returns current integrity and lifecycle status
- verifiable provenance metadata can be retrieved where enabled
- authorization boundaries are explicit at the route level

Operational deployment details such as environment-specific key custody, hosting controls, and external provider posture remain infrastructure concerns outside the public integration contract.
