# TrustSignal GitHub Action Integration

## Purpose

`TrustSignal Verify Artifact` is a GitHub Action integration for verifying build artifacts through the TrustSignal API. The action calls `api.trustsignal.dev`, receives a signed verification receipt, and stores that receipt identifier for later verification workflows.

The GitHub Action does not connect to Supabase directly. TrustSignal persists receipts server-side behind the public API boundary.

## Verification Flow

1. The workflow sends an artifact hash or local artifact path through the GitHub Action.
2. The action calls `POST /api/v1/verify` on `api.trustsignal.dev`.
3. TrustSignal validates the request, authenticates the caller, issues a signed receipt, and persists the receipt server-side.
4. The action writes `verification_id`, `status`, `receipt_id`, and `receipt_signature` as GitHub Actions outputs.
5. Public consumers can inspect the stored receipt through `GET /api/v1/receipt/{receiptId}` or render a compact badge from `GET /api/v1/receipt/{receiptId}/summary`.
6. A later workflow can call `POST /api/v1/receipt/{receiptId}/verify` with an artifact hash to confirm integrity.

## Public API Contract

### `POST /api/v1/verify`

Headers:

```http
x-api-key: <trustsignal-api-key>
content-type: application/json
```

Request body sent by the action:

```json
{
  "artifact": {
    "hash": "<sha256>",
    "algorithm": "sha256"
  },
  "source": {
    "provider": "github-actions",
    "repository": "<repo>",
    "workflow": "<workflow>",
    "runId": "<runId>",
    "commit": "<sha>",
    "actor": "<actor>"
  },
  "metadata": {
    "artifactPath": "<optional>"
  }
}
```

Response fields used by the action (both snake_case and camelCase variants are accepted):

| Action output | API field(s) read |
| --- | --- |
| `verification_id` | `verification_id`, `verificationId`, `id`, `receipt_id`, `receiptId` |
| `status` | `status`, `verificationStatus`, `result`, `verified`, `valid`, `match` |
| `receipt_id` | `receipt_id`, `receiptId` |
| `receipt_signature` | `receipt_signature` (string), `receiptSignature` (string or `{ signature }` object) |

The action request enforces a 30-second timeout. An `AbortError` from the timeout is reported
as a clean error message without exposing raw headers or internal service details.

### `GET /api/v1/receipt/{receiptId}`

This endpoint returns a compact inspection view for artifact receipts. It is intended for receipt drill-down pages and audit references.

### `GET /api/v1/receipt/{receiptId}/summary`

This endpoint returns a compact display payload for trust centers, evidence panels, and partner dashboards.

### `POST /api/v1/receipt/{receiptId}/verify`

Request body:

```json
{
  "artifact": {
    "hash": "<sha256>",
    "algorithm": "sha256"
  }
}
```

Response fields:

- `verified`
- `integrityVerified`
- `signatureVerified`
- `status`
- `receiptId`
- `receiptSignature`
- `storedHash`
- `recomputedHash`

## Security Boundary

- The GitHub Action calls TrustSignal API only.
- Supabase is private backend persistence and is not a public integration surface.
- Service role credentials are backend-only and must never be exposed to clients.
- Artifact receipts are stored for later verification.
- Row Level Security is enabled on the artifact receipt table as defense in depth.
- Public lookup and summary endpoints are read-only and return safe receipt fields only.
- Later verification remains behind TrustSignal API authentication.
- `fail_on_mismatch: true` (default) provides fail-closed behavior for pipelines that require verified artifacts.

## Validation

- Local contract tests: `npm run test:local` (uses mock fetch, no live API required)
- Dist alignment check: `npm run check:dist` (SHA-256 comparison of `src` and `dist`)
- Live integration test: `npm run test:integration` (skips when credentials are absent)

See `github-actions/trustsignal-verify-artifact/docs/integration.md` for the full integration guide.

## Current Limitations

- The public verification contract currently accepts `sha256` only.
- GitHub Marketplace publication requires extracting this action into a dedicated public repository with `action.yml` at the repository root.

