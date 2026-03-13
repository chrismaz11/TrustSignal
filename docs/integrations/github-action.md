# TrustSignal GitHub Action Integration

## Purpose

`TrustSignal Verify Artifact` is a GitHub Action integration for verifying build artifacts through the TrustSignal API. The action calls `api.trustsignal.dev`, receives a signed verification receipt, and stores that receipt identifier for later verification workflows.

The GitHub Action does not connect to Supabase directly. TrustSignal persists receipts server-side behind the public API boundary.

## Verification Flow

1. The workflow sends an artifact hash or local artifact path through the GitHub Action.
2. The action calls `POST /api/v1/verify` on `api.trustsignal.dev`.
3. TrustSignal validates the request, authenticates the caller, issues a signed receipt, and persists the receipt server-side.
4. The action stores `receiptId` and `receiptSignature` for later verification or audit use.
5. A later workflow can call `POST /api/v1/receipt/{receiptId}/verify` with an artifact hash to confirm integrity.

## Public API Contract

### `POST /api/v1/verify`

Headers:

```http
x-api-key: <trustsignal-api-key>
content-type: application/json
```

Request body:

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

Response fields used by the action:

- `verificationId`
- `receiptId`
- `receiptSignature`
- `status`

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

## Current Limitations

- The repository includes a local smoke test, but a live deployed integration test remains pending.
- The public verification contract currently accepts `sha256` only.
