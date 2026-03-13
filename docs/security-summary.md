# TrustSignal Public Security Summary

> TrustSignal is evidence integrity infrastructure for signed verification receipts and later verification.

Short description:
This public-safe security summary explains the TrustSignal integration boundary, security posture, and claims boundary without exposing non-public implementation details.

Audience:
- partner security reviewers
- evaluators
- developers

## Problem / Context

Partners and evaluators need a public-safe security summary that explains the attack surface without exposing internal implementation details. In high-stakes workflows, evidence can be challenged after collection through tampered evidence, provenance loss, artifact substitution, or stale records that are no longer independently verifiable.

## Integrity Model

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability for existing workflow integration.

## How It Works

TrustSignal public security materials focus on the integration-facing integrity layer:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration

## Integration Fit

For the public `/api/v1/*` surface in this repository:

- `x-api-key` authentication is required for partner operations
- keys are scope-bound to `verify`, `read`, `anchor`, and `revoke`
- request validation and rate limiting are enforced at the API boundary
- receipt revocation requires additional issuer authorization headers
- later verification is available through a dedicated receipt verification route
- the GitHub Action calls TrustSignal API, not Supabase directly
- artifact receipts are persisted server-side behind the API boundary
- Supabase service-role credentials are backend-only and must never be exposed to browser or action code
- Row Level Security is enabled on the artifact receipt table as defense in depth

Evaluator and demo flows are deliberate evaluator paths. They are designed to show the verification lifecycle safely before production integration.

## Production Considerations

> [!IMPORTANT]
> Production considerations: public evaluator documentation does not replace environment-specific authentication, signing configuration, hosting controls, secret management, or operational review.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Security And Claims Boundary

> [!NOTE]
> Claims boundary: this summary covers the public-safe security posture only. It does not expose proof internals, signing infrastructure specifics, internal service topology, or unsupported legal/compliance claims.

## Technical Detail

TrustSignal public materials should be understood within this boundary:

TrustSignal provides:

- signed verification receipts
- verification signals
- verifiable provenance metadata
- later verification capability
- an integrity layer for existing workflows

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- a replacement for the system of record
- infrastructure claims that depend on deployment-specific evidence outside this repository

## Related Documentation

- [docs/partner-eval/security-summary.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/security-summary.md)
- [SECURITY_CHECKLIST.md](/Users/christopher/Projects/trustsignal/SECURITY_CHECKLIST.md)
- [docs/SECURITY.md](/Users/christopher/Projects/trustsignal/docs/SECURITY.md)
- [wiki/Claims-Boundary.md](/Users/christopher/Projects/trustsignal/wiki/Claims-Boundary.md)
