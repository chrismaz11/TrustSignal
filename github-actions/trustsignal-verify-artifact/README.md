# TrustSignal Verify Artifact

`TrustSignal Verify Artifact` is a JavaScript GitHub Action for generic build artifact verification. It hashes a build artifact or accepts a precomputed SHA-256 digest, submits that identity to TrustSignal, and returns signed receipt metadata to the workflow.

TrustSignal issues signed verification receipts for the artifact identity you submit. Store the returned `receipt_id` if you want to support later verification flows in downstream systems.

## What This Action Does

- Verifies build artifacts with a generic TrustSignal artifact verification contract.
- Accepts either a local artifact path or a precomputed SHA-256 hash.
- Adds GitHub workflow context automatically when it is available in the runtime environment.
- Returns receipt metadata that can be persisted for later verification.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `api_base_url` | Yes | Base URL for the TrustSignal public API, such as `https://api.trustsignal.dev`. |
| `api_key` | Yes | API key for the TrustSignal public verification endpoint. Store this in GitHub Actions secrets. |
| `artifact_path` | No | Local path to the artifact file to hash with SHA-256. |
| `artifact_hash` | No | Precomputed SHA-256 digest to verify instead of hashing a local file. |
| `source` | No | Source provider label attached to the verification request. Defaults to `github-actions`. |
| `fail_on_mismatch` | No | When `true`, fails the workflow if TrustSignal does not return a valid verification result. Defaults to `true`. |

Provide exactly one of `artifact_path` or `artifact_hash`.

## Outputs

| Output | Description |
| --- | --- |
| `verification_id` | Verification identifier returned by TrustSignal. |
| `status` | Verification status normalized from the TrustSignal API response. |
| `receipt_id` | Receipt identifier returned by TrustSignal. |
| `receipt_signature` | Receipt signature returned by TrustSignal. |

Compatibility note:

- `verification_id` falls back to `receipt_id` when the API does not return a distinct verification identifier.

## Request Contract

The action sends `POST /api/v1/verify` with this body shape:

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

The action adds `source.repository`, `source.workflow`, `source.runId`, `source.commit`, and `source.actor` automatically from the GitHub Actions runtime when those values are available.

## Example Workflow Using `artifact_path`

```yaml
name: Verify Build Artifact

on:
  push:
    branches: [main]

jobs:
  verify-artifact:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Build artifact
        run: |
          mkdir -p dist
          echo "release bundle" > dist/release.txt

      - name: Verify artifact with TrustSignal
        id: trustsignal
        uses: trustsignal-dev/trustsignal-verify-artifact@v1
        with:
          api_base_url: https://api.trustsignal.dev
          api_key: ${{ secrets.TRUSTSIGNAL_API_KEY }}
          artifact_path: dist/release.txt
          source: github-actions
          fail_on_mismatch: "true"

      - name: Print receipt metadata
        run: |
          echo "Verification: ${{ steps.trustsignal.outputs.verification_id }}"
          echo "Status: ${{ steps.trustsignal.outputs.status }}"
          echo "Receipt: ${{ steps.trustsignal.outputs.receipt_id }}"
```

## Example Workflow Using `artifact_hash`

```yaml
name: Verify Precomputed Hash

on:
  workflow_dispatch:

jobs:
  verify-artifact-hash:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Verify known artifact digest
        id: trustsignal
        uses: trustsignal-dev/trustsignal-verify-artifact@v1
        with:
          api_base_url: https://api.trustsignal.dev
          api_key: ${{ secrets.TRUSTSIGNAL_API_KEY }}
          artifact_hash: 2f77668a9dfbf8d5847cf2d5d0370740e0c0601b4f061c1181f58c77c2b8f486
          source: github-actions
          fail_on_mismatch: "true"

      - name: Print result
        run: |
          echo "Verification: ${{ steps.trustsignal.outputs.verification_id }}"
          echo "Status: ${{ steps.trustsignal.outputs.status }}"
```

Later verification is possible by storing the returned `receipt_id` and using it with TrustSignal APIs that expose receipt lookup or verification.

## Security Notes

- The action never logs the API key.
- The API key is sent only in the `x-api-key` header.
- API failures are surfaced with concise HTTP status messages and without raw internal details.
- Inputs are validated before any request is sent.
- Local artifact hashing uses SHA-256 from Node.js `crypto`.

## Current Limitations

- This package is an integration scaffold and assumes a TrustSignal deployment that supports the generic artifact verification contract documented here.
- A live deployed API integration test is still pending; the included local test uses a fetch mock that validates the contract shape and action behavior.
- This package currently lives under `github-actions/trustsignal-verify-artifact/` inside the TrustSignal monorepo, so it is not yet directly publishable to GitHub Marketplace.

## Local Validation

Run the local syntax checks and contract test with:

```bash
node --check src/index.js
node --check dist/index.js
node scripts/test-local.js
```

Or use the package scripts:

```bash
npm run check
npm run test:local
npm run validate:local
```

## Marketplace Readiness Status

- Not Marketplace-ready while it lives under `github-actions/trustsignal-verify-artifact/` inside the TrustSignal monorepo.
- Marketplace publication requires a dedicated public repository with `action.yml` at the repository root.
- Marketplace publication also requires release tagging, committed `dist/index.js` artifacts, and final public repository metadata.
- Update the README and integration doc when the public TrustSignal API contract or output fields change.
