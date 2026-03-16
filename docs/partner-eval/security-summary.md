# Partner Security Summary

> TrustSignal is evidence integrity infrastructure for signed verification receipts and later verification.

Short description:
This partner-facing security summary explains the public TrustSignal integration boundary, key controls, and claims boundary for existing workflow integration.

Audience:
- partner security reviewers
- evaluators
- technical sponsors

## Executive Summary

TrustSignal exposes a public integration boundary built around signed verification receipts, verification signals, verifiable provenance, and later verification. The public security posture is focused on route-level authorization, explicit lifecycle controls, and fail-closed defaults without exposing non-public implementation details.

## Key Facts / Scope

- Scope: public `/api/v1/*` integration boundary
- Focus: evaluator-safe security posture
- Out of scope: internal implementation details and deployment-specific infrastructure controls

## Main Content

### Problem / Context

Partners need enough security detail to evaluate the integration boundary without exposing internal implementation details that are not required for integration.

### Integrity Model

TrustSignal provides a public API boundary that is centered on signed verification receipts, verification signals, verifiable provenance metadata, and later verification.

### How It Works

TrustSignal public security materials focus on:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration

### Integration Fit

For the public `/api/v1/*` surface in this repository:

- `x-api-key` authentication is required for partner operations.
- Keys are scope-bound to actions such as `verify`, `read`, `anchor`, and `revoke`.
- Request validation, rate limiting, and structured service logging are implemented at the API gateway.
- Receipt revocation requires additional issuer authorization headers.

### Security And Claims Boundary

> [!NOTE]
> Claims boundary: this summary covers the public-safe integration surface only. It does not expose proof internals, signer infrastructure specifics, internal topology, or unsupported legal/compliance claims.

### Technical Detail

TrustSignal does not require partners to understand internal proof systems, internal service topology, or signing infrastructure details in order to integrate.

For public evaluation, the important security properties are:

- signed verification receipts can be stored and checked later
- later verification returns current integrity and lifecycle status
- verifiable provenance metadata can be retrieved where enabled
- authorization boundaries are explicit at the route level

Operational deployment details such as environment-specific key custody, hosting controls, and external provider posture remain infrastructure concerns outside the public integration contract.

## Related Artifacts / References

- [docs/security-summary.md](../security-summary.md)
- [docs/partner-eval/overview.md](overview.md)
- [wiki/Claims-Boundary.md](../../wiki/Claims-Boundary.md)
- [SECURITY_CHECKLIST.md](../../SECURITY_CHECKLIST.md)
