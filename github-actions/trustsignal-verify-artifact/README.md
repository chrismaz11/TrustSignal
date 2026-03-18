# TrustSignal Verify Artifact

Verify release artifacts in CI, issue signed verification receipts, and preserve provenance for downstream verification and audit workflows.

[![License: MIT](https://img.shields.io/badge/license-MIT-informational)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)

`TrustSignal Verify Artifact` is a JavaScript GitHub Action for teams that need a reliable verification checkpoint inside CI/CD. It hashes a build artifact or accepts a precomputed SHA-256 digest, submits that artifact identity to TrustSignal, and returns receipt metadata that can be retained with release records, provenance evidence, and downstream audit workflows.

TrustSignal is designed for artifact integrity, signed verification receipts, verifiable provenance, and audit-ready release controls.

## Features

- Verify build artifacts directly inside GitHub Actions
- Issue signed verification receipts for CI outputs
- Preserve provenance context from the GitHub workflow runtime
- Support later verification and audit workflows through `receipt_id`
- Fail closed on invalid or mismatched verification results when required

## Why Teams Use It

- Add a lightweight integrity control to release workflows
- Preserve a verifiable record of what was checked in CI
- Improve traceability across build, release, and audit paths
- Standardize artifact verification without embedding internal platform logic in workflows

## Quick Start

1. Add `TRUSTSIGNAL_API_BASE_URL` and `TRUSTSIGNAL_API_KEY` to GitHub Actions secrets.
2. Call the action with either `artifact_path` or `artifact_hash`.
3. Capture `receipt_id` and `receipt_signature` in downstream steps.
4. Store receipt metadata anywhere you need later verification or audit evidence.

## Inputs

| Input | Required | Description |
| --- | --- | --- |
| `api_base_url` | Yes | Base URL for the TrustSignal public API, for example `https://api.trustsignal.dev`. |
| `api_key` | Yes | TrustSignal API key. Pass it from GitHub Actions secrets. |
| `artifact_path` | No | Local path to the artifact file to hash with SHA-256. |
| `artifact_hash` | No | Precomputed SHA-256 digest to verify instead of hashing a local file. |
| `source` | No | Source provider label sent in the verification request. Defaults to `github-actions`. |
| `fail_on_mismatch` | No | When `true`, the action fails on non-valid verification results. Defaults to `true`. |

Provide exactly one of `artifact_path` or `artifact_hash`.

## Outputs

| Output | Description |
| --- | --- |
| `verification_id` | Verification identifier returned by TrustSignal. For compatibility, this aliases `receipt_id` when the API does not return a separate verification identifier. |
| `status` | Normalized verification status returned by the API. |
| `receipt_id` | Signed receipt identifier returned by TrustSignal. |
| `receipt_signature` | Signed receipt signature returned by TrustSignal. |

## Example Usage

### Verify An Artifact File

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
          api_base_url: ${{ secrets.TRUSTSIGNAL_API_BASE_URL }}
          api_key: ${{ secrets.TRUSTSIGNAL_API_KEY }}
          artifact_path: dist/release.txt
          source: github-actions
          fail_on_mismatch: "true"

      - name: Record verification outputs
        run: |
          echo "Verification ID: ${{ steps.trustsignal.outputs.verification_id }}"
          echo "Status: ${{ steps.trustsignal.outputs.status }}"
          echo "Receipt ID: ${{ steps.trustsignal.outputs.receipt_id }}"
          echo "Receipt Signature: ${{ steps.trustsignal.outputs.receipt_signature }}"
```

### Verify A Precomputed Hash

```yaml
name: Verify Artifact Hash

on:
  workflow_dispatch:

jobs:
  verify-hash:
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Verify known digest
        id: trustsignal
        uses: trustsignal-dev/trustsignal-verify-artifact@v1
        with:
          api_base_url: ${{ secrets.TRUSTSIGNAL_API_BASE_URL }}
          api_key: ${{ secrets.TRUSTSIGNAL_API_KEY }}
          artifact_hash: 2f77668a9dfbf8d5847cf2d5d0370740e0c0601b4f061c1181f58c77c2b8f486
          source: github-actions
          fail_on_mismatch: "true"

      - name: Print verification result
        run: |
          echo "Verification ID: ${{ steps.trustsignal.outputs.verification_id }}"
          echo "Status: ${{ steps.trustsignal.outputs.status }}"
```

## Request Contract

The action calls `POST /api/v1/verify` with a generic artifact verification payload:

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

GitHub workflow context is added automatically when those environment variables are available at runtime.

## Security Considerations

- The API key is sent only in the `x-api-key` header.
- The action does not log secrets.
- Error messages are concise and avoid raw internal details.
- Local artifact hashing uses SHA-256 from Node.js `crypto`.
- `fail_on_mismatch` allows pipelines to enforce fail-closed verification behavior.

## Why TrustSignal

TrustSignal gives security and release teams a consistent way to verify artifact identity inside CI/CD while preserving signed evidence for later validation. The action is built to support integrity controls, provenance continuity, and audit-ready release workflows without forcing teams to reimplement verification logic in every pipeline.

## Current Limitations

- GitHub Marketplace publication requires this action to be published from a dedicated public repository root with `action.yml` at the top level.

## Local Validation

Run the complete validation suite with:

```bash
npm run validate
```

This runs a syntax check, a dist alignment check (SHA-256 comparison of `src` and `dist`), and the local contract test. No live API is required.

Individual commands:

```bash
node --check src/index.js
node --check dist/index.js
node scripts/check-dist.js
node scripts/test-local.js
```

## Live Integration Test

To validate against a deployed TrustSignal API:

```bash
export TRUSTSIGNAL_INTEGRATION_API_BASE_URL=https://api.trustsignal.dev
export TRUSTSIGNAL_INTEGRATION_API_KEY=<your-api-key>
npm run test:integration
```

The test skips cleanly when the environment variables are not set. See `docs/integration.md` for details.

## Versioning Guidance

- Follow semantic versioning.
- Publish immutable release tags for each shipped version (e.g., `v0.2.0`).
- Maintain a stable major tag such as `v1` for consumers who want automatic non-breaking updates.
- See `docs/release-checklist.md` for the complete release process.

## Release Checklist Summary

- Confirm `src/index.js` changes are intentional.
- Run `npm run build` and then `npm run validate` to confirm dist alignment.
- Create an immutable version tag and update the stable major tag.
- Confirm `action.yml` references `dist/index.js` as the action entrypoint.
- Update documentation when the API contract or output field mapping changes.
