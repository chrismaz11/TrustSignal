# TrustSignal Public Security Summary

## Problem

Partners and evaluators need a public-safe security summary that explains the attack surface without exposing internal implementation details. In high-stakes workflows, evidence can be challenged after collection through tampered evidence, provenance loss, artifact substitution, or stale records that are no longer independently verifiable.

## Integrity Model

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability for existing workflow integration.

## Integration Fit

For the public `/api/v1/*` surface in this repository:

- `x-api-key` authentication is required for partner operations
- keys are scope-bound to `verify`, `read`, `anchor`, and `revoke`
- request validation and rate limiting are enforced at the API boundary
- receipt revocation requires additional issuer authorization headers
- later verification is available through a dedicated receipt verification route

Evaluator and demo flows are deliberate evaluator paths. They are designed to show the verification lifecycle safely before production integration.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

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
