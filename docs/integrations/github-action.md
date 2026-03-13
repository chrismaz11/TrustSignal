# TrustSignal GitHub Action Integration

## Purpose

`TrustSignal Verify Artifact` is a GitHub Action for verifying build artifacts with TrustSignal. It computes or accepts a SHA-256 digest for an artifact, sends that artifact identity to TrustSignal, and returns receipt metadata that a workflow can persist for later integrity checks.

TrustSignal remains a neutral evidence integrity platform. The action uses a generic artifact verification contract and does not depend on domain-specific schemas.

## Artifact Verification Flow

1. The workflow passes either `artifact_path` or `artifact_hash`.
2. The action computes a SHA-256 digest when a local path is provided.
3. The action builds a generic verification payload with artifact identity plus GitHub workflow context.
4. The action sends `POST /api/v1/verify` with the TrustSignal API key in the `x-api-key` header.
5. TrustSignal returns verification metadata and a signed receipt reference.
6. The workflow consumes the action outputs or stores the `receipt_id` for later verification.

## Request Contract Used By The Action

Endpoint:

```http
POST /api/v1/verify
```

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

## Outputs

| Output | Meaning |
| --- | --- |
| `verification_id` | TrustSignal verification identifier returned by the API. |
| `status` | Verification status returned by the API. |
| `receipt_id` | Signed receipt identifier returned by the API. |
| `receipt_signature` | Receipt signature returned by the API. |

If the API does not return a distinct verification identifier, the action exposes `verification_id` as a compatibility alias to `receipt_id`.

## Example Workflow

```yaml
name: Verify Artifact

on:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build artifact
        run: |
          mkdir -p dist
          echo "build output" > dist/app.txt

      - name: Verify artifact with TrustSignal
        id: trustsignal
        uses: trustsignal-dev/trustsignal-verify-artifact@v1
        with:
          api_base_url: https://api.trustsignal.dev
          api_key: ${{ secrets.TRUSTSIGNAL_API_KEY }}
          artifact_path: dist/app.txt
          source: github-actions
          fail_on_mismatch: "true"

      - name: Record receipt
        run: |
          echo "Verification ID: ${{ steps.trustsignal.outputs.verification_id }}"
          echo "Receipt ID: ${{ steps.trustsignal.outputs.receipt_id }}"
          echo "Receipt signature: ${{ steps.trustsignal.outputs.receipt_signature }}"
```

## Current Limitations

- The local contract test uses a fetch mock rather than a live TrustSignal deployment.
- This package currently lives in a monorepo subdirectory, so it is not directly publishable to GitHub Marketplace.
- A production-facing integration test against a deployed TrustSignal environment is still pending.

## Next Steps Before Marketplace Publication

- Extract the package into a dedicated public repository.
- Move `action.yml` to the repository root in that dedicated repository.
- Tag versioned releases and commit `dist/index.js` for each published release.
- Add a live integration test against a deployed TrustSignal verification endpoint.
