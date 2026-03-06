# Endpoint Mapping: Proposed Partner API vs Current API

| Proposed partner endpoint | Current endpoint in repo | Notes |
|---|---|---|
| `POST /partner/v1/verify/document` | `POST /api/v1/verify` | Same core function; partner wrapper can normalize request fields. |
| `GET /partner/v1/verify/{id}/status` | `GET /api/v1/integrations/vanta/verification/{receiptId}` | Existing endpoint already returns Vanta-structured status/result payload. |
| `GET /partner/v1/verify/{id}/receipt` | `GET /api/v1/receipt/{receiptId}` | Existing endpoint returns raw + canonical receipt details. |
| `POST /partner/v1/webhooks/register` (proposed) | Not implemented | Define callback registry if webhook model is adopted. |

## Recommendation for Tomorrow's Demo

- Use current `/api/v1/*` endpoints for live proof.
- Present `/partner/v1/*` as stable contract layer for production partnership branding and versioning.
