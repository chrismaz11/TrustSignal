**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# API Overview

## Problem

Partners need a stable public contract that explains how TrustSignal fits into an existing workflow without requiring them to understand internal implementation details. The relevant attack surface includes tampered evidence, provenance loss, artifact substitution, and stale evidence in later review paths.

## Integrity Model

TrustSignal exposes a public verification lifecycle centered on signed verification receipts, verification signals, verifiable provenance metadata, and later verification.

## Evaluator Path

Start here to try the public lifecycle:

- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [Postman collection](/Users/christopher/Projects/trustsignal/postman/TrustSignal.postman_collection.json)

Golden path:

1. submit a verification request
2. receive verification signals plus a signed verification receipt
3. retrieve the stored receipt
4. run later verification

## Integration Fit

The integration-facing `/api/v1/*` surface is the main public partner API in this repository. It uses `x-api-key` authentication with scoped access such as `verify`, `read`, `anchor`, and `revoke`.

The legacy `/v1/*` surface is still present for the current JavaScript SDK and uses bearer JWT authentication.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Technical Detail

### Integration-Facing Verification Lifecycle

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/v1/verify` | `x-api-key` with `verify` | Create a verification and receive a signed verification receipt |
| `GET` | `/api/v1/receipt/:receiptId` | `x-api-key` with `read` | Retrieve a stored receipt |
| `GET` | `/api/v1/receipt/:receiptId/pdf` | `x-api-key` with `read` | Download a PDF rendering of the receipt |
| `POST` | `/api/v1/receipt/:receiptId/verify` | `x-api-key` with `read` | Run later verification for a stored receipt |
| `POST` | `/api/v1/receipt/:receiptId/revoke` | `x-api-key` with `revoke` | Revoke a receipt with issuer authorization |
| `POST` | `/api/v1/anchor/:receiptId` | `x-api-key` with `anchor` | Return provenance state for a receipt when enabled |
| `GET` | `/api/v1/receipts` | `x-api-key` with `read` | List recent receipts |

`POST /api/v1/receipt/:receiptId/revoke` also requires these issuer authorization headers:

- `x-issuer-id`
- `x-signature-timestamp`
- `x-issuer-signature`

### Additional Integration Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/health` | Service health snapshot |
| `GET` | `/api/v1/status` | Deployment status snapshot |
| `GET` | `/api/v1/metrics` | Prometheus-compatible metrics |
| `GET` | `/api/v1/integrations/vanta/schema` | Vanta schema metadata |
| `GET` | `/api/v1/integrations/vanta/verification/:receiptId` | Normalized verification payload for Vanta workflows |
| `POST` | `/api/v1/verify/attom` | Cook County ATTOM cross-check |

### Legacy JWT Surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/v1/verify-bundle` | bearer JWT | Verify a bundle |
| `GET` | `/v1/status/:bundleId` | bearer JWT | Check bundle status |
| `POST` | `/v1/revoke` | bearer JWT with admin authorization | Revoke a bundle |

### Error Semantics

Integrators should expect these broad patterns:

- `400` for request-shape errors
- `401` or `403` for missing credentials, invalid credentials, or missing scope
- `404` for unknown receipts
- `409` for lifecycle conflicts
- `429` for rate limiting
- `503` when a required dependency is unavailable

The canonical public contract for the verification lifecycle is [openapi.yaml](/Users/christopher/Projects/trustsignal/openapi.yaml).
