# TrustSignal Public Verification

## Why Public Verification Matters

TrustSignal receipts are designed to travel with an artifact after the initial workflow run. A team can issue a signed verification receipt once, store the receipt identifier with its evidence record, and later let auditors, buyers, or partner platforms inspect the receipt without exposing internal systems.

This makes TrustSignal useful in trust-center views, evidence panels, and partner review workflows where the downstream user needs a compact integrity signal rather than internal engine details.

## Receipt Lookup Flow

1. A workflow issues a signed receipt through `POST /api/v1/verify`.
2. The caller stores `receiptId` with its evidence or build record.
3. A public or partner-facing surface retrieves the safe receipt view with `GET /api/v1/receipt/{receiptId}`.

The public lookup response is artifact-oriented and omits internal scoring, signing secrets, and private service details.

## Later Verification Flow

1. A trusted integration submits an artifact hash to `POST /api/v1/receipt/{receiptId}/verify`.
2. TrustSignal compares the supplied hash with the stored artifact hash.
3. The API returns whether integrity and signature checks still pass.

This route remains authenticated. Public inspection is read-only; active verification stays behind the TrustSignal API boundary.

## Partner Summary Flow

`GET /api/v1/receipt/{receiptId}/summary` returns a compact verification badge payload for trust centers, compliance dashboards, and partner evidence panels.

It is designed for simple display logic:

- `status`
- `integrityState`
- `issuedAt`
- source summary
- a ready-to-render `display` object

## Example Partner Uses

### Drata-style evidence view

Store `receiptId` alongside a control evidence record. When an auditor opens the evidence detail, the platform can fetch `/summary` and render a compact TrustSignal integrity badge next to the artifact metadata.

### Vanta-style evidence view

Attach the receipt to a control test result. Use `/receipt/{receiptId}` for drill-down and `/summary` for the evidence list row.

### Public trust center or vendor review

Expose a receipt inspector link such as `/verify/{receiptId}`. Buyers can review the signed receipt metadata without gaining access to private systems or backend persistence.

## Verification Badge Example

```json
{
  "receiptId": "8fb78fc6-2763-4e63-9f65-67da2f9f6d98",
  "status": "verified",
  "integrityState": "valid",
  "issuedAt": "2026-03-13T09:06:47.000Z",
  "display": {
    "label": "TrustSignal Verified",
    "tone": "success",
    "statement": "This artifact has a signed verification receipt and can be checked later for integrity drift."
  }
}
```
