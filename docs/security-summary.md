# TrustSignal Public Security Summary

## Problem

Partners and evaluators need a public-safe summary of the TrustSignal security boundary without exposing internal implementation details that are not required for integration.

## Integrity Model

TrustSignal provides signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability for existing workflows.

## Integration Fit

For the public `/api/v1/*` surface in this repository:

- `x-api-key` authentication is required for partner operations
- keys are scope-bound to `verify`, `read`, `anchor`, and `revoke`
- request validation and rate limiting are enforced at the API boundary
- receipt revocation requires additional issuer authorization headers
- later verification is available through a dedicated receipt verification route

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
