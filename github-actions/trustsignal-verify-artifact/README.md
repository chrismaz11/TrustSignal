# TrustSignal Verify Artifact

Verify build artifacts in CI, issue signed verification receipts, and preserve provenance for later verification and audit workflows.

[![License: MIT](https://img.shields.io/badge/license-MIT-informational)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-339933?logo=node.js&logoColor=white)](package.json)

`TrustSignal Verify Artifact` is a JavaScript GitHub Action for teams that want a clean verification checkpoint inside CI/CD. It hashes a build artifact or accepts a precomputed SHA-256 digest, submits that identity to TrustSignal, and returns receipt metadata your pipeline can persist, attach to release records, or feed into later verification workflows.

TrustSignal is built for artifact integrity, signed receipts, verifiable provenance, and downstream auditability without exposing internal verification engine details.

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

1. Add a TrustSignal API key to GitHub Actions secrets.
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
| `verification_id` | Verification identifier returned by TrustSignal. Falls back to `receipt_id` when the API does not return a separate value. |
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
          api_base_url: https://api.trustsignal.dev
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
          api_base_url: https://api.trustsignal.dev
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

TrustSignal helps teams add a verification layer to CI/CD without exposing proprietary implementation details in every workflow. The action focuses on artifact identity, signed receipts, provenance continuity, and later verification so integrity signals can travel with the software lifecycle.

## Current Limitations

- The local test path uses a fetch mock rather than a live TrustSignal deployment.
- This package is extractable today, but Marketplace publication still requires a dedicated public repository root.
- A production-facing integration test against a deployed TrustSignal API is still pending.

## Local Validation

Run the lightweight validation checks with:

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

## Versioning Guidance

- Follow semantic versioning.
- Publish immutable release tags such as `v0.1.0`, `v0.2.0`, and `v1.0.0`.
- Maintain a major tag such as `v1` for stable consumers.

## Release Guidance

- Commit the built `dist/index.js` artifact with every release.
- Create signed or otherwise controlled release tags according to your release process.
- Update documentation when the public API contract or output mapping changes.
- Marketplace publication requires a public repository, a root-level `action.yml`, and release tags.

## Roadmap

- Add a live integration test against a deployed TrustSignal verification endpoint
- Publish the action from a dedicated public repository root
- Add example workflows for release pipelines and provenance retention patterns

## Suggested GitHub Topics

- `github-action`
- `devsecops`
- `ci-cd`
- `artifact-integrity`
- `supply-chain-security`
- `compliance`
- `provenance`
- `verification`
