# Integration Guide

## Overview

`TrustSignal Verify Artifact` verifies build artifacts in CI, issues signed verification receipts, and returns receipt metadata that downstream systems can use for provenance and later verification workflows.

## Verification Flow

1. The action accepts either `artifact_path` or `artifact_hash`.
2. A SHA-256 digest is computed locally when a file path is provided.
3. The action sends the artifact identity and GitHub workflow context to `POST /api/v1/verify`.
4. TrustSignal returns verification metadata, including a receipt identifier and receipt signature.
5. The workflow stores `receipt_id` for later verification, audit, or provenance workflows.

## Request Contract

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

GitHub workflow context values (`repository`, `workflow`, `runId`, `actor`, `commit`) are read from
standard GitHub Actions environment variables and included automatically when they are set.

## Response Contract

The action reads the following fields from the API response. Both snake_case and camelCase variants
are accepted for compatibility:

| Output field | API field(s) read |
| --- | --- |
| `verification_id` | `verification_id`, `verificationId`, `id`, `receipt_id`, `receiptId` (first non-empty) |
| `status` | `status`, `verificationStatus`, `result`, `verified`, `valid`, `match` |
| `receipt_id` | `receipt_id`, `receiptId` |
| `receipt_signature` | `receipt_signature` (string), `receiptSignature` (string or `{ signature }` object) |

If the API omits a distinct verification identifier, the action uses `receipt_id` as a compatibility
alias for `verification_id`.

## Security Behavior

- The API key is transmitted only in the `x-api-key` request header. It is never logged.
- Error messages include the HTTP status code and the API-provided message only.
  Raw headers and internal service details are not surfaced.
- `callVerificationApi` enforces a 30-second AbortController timeout to prevent hangs.
- `fail_on_mismatch: true` (the default) causes the action to exit non-zero when the
  TrustSignal response does not indicate a valid verification result. This provides
  fail-closed behavior for pipelines that require verified artifacts.

## Local Validation

```bash
# Syntax check
node --check src/index.js && node --check dist/index.js

# Dist alignment check (confirms dist matches src by SHA-256)
node scripts/check-dist.js

# Local contract test (uses mock fetch — no live API required)
node scripts/test-local.js

# Full local validation
npm run validate
```

## Live Integration Test

To validate against a deployed TrustSignal API endpoint:

```bash
export TRUSTSIGNAL_INTEGRATION_API_BASE_URL=https://api.trustsignal.dev
export TRUSTSIGNAL_INTEGRATION_API_KEY=<your-api-key>
node scripts/integration-test.js
```

The integration test:
- Verifies a test artifact by file path and by precomputed hash.
- Confirms all four output fields are present in the response.
- Confirms that an invalid API key is rejected with a non-zero exit.
- Skips cleanly when the environment variables are not set.

## Notes

- Marketplace publication requires extracting this action into a dedicated public repository
  with `action.yml` at the repository root.
- See `docs/release-checklist.md` for the complete pre-release and tagging checklist.

