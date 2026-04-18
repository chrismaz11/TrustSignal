# Release Checklist

This checklist must be completed before every version tag is pushed for `TrustSignal Verify Artifact`.

---

## Pre-Release: Source and Dist Alignment

- [ ] `src/index.js` reflects all intended changes for this release.
- [ ] `npm run build` was run to copy `src/index.js` to `dist/index.js`.
- [ ] `npm run check:dist` passes — confirms `dist/index.js` matches `src/index.js` by SHA-256.
- [ ] `npm run check` passes — no syntax errors in source or dist.

## Pre-Release: Local Contract Validation

- [ ] `npm run test:local` passes — all local action contract assertions succeed.
- [ ] Mock response fields (`verification_id`, `status`, `receipt_id`, `receipt_signature`) are still exercised.

## Pre-Release: Integration Validation (when credentials available)

- [ ] `npm run test:integration` passes against a deployed TrustSignal API endpoint.
  - Set `TRUSTSIGNAL_INTEGRATION_API_BASE_URL` and `TRUSTSIGNAL_INTEGRATION_API_KEY` before running.
  - Confirms live end-to-end output field contract.
  - Confirms invalid API key is rejected with a non-zero exit.

## Pre-Release: Documentation

- [ ] `README.md` reflects the current input and output contract.
- [ ] `action.yml` output descriptions are accurate.
- [ ] `docs/integration.md` reflects any API contract changes.
- [ ] `CHANGELOG.md` has an entry for this release (if maintained).

## Pre-Release: Security

- [ ] No secrets, API keys, or tokens are hardcoded in source or dist.
- [ ] Error messages do not leak raw API responses, headers, or internal service details.
- [ ] `fail_on_mismatch` default remains `true` (fail-closed behavior preserved).
- [ ] Request timeout is present in `callVerificationApi` (AbortController).

## Release Tag

- [ ] Create an immutable semver tag, for example `v0.2.0`.
  ```bash
  git tag -a v0.2.0 -m "Release v0.2.0"
  git push origin v0.2.0
  ```
- [ ] Do not document or publish a stable major tag unless maintainers have explicitly adopted that policy.
- [ ] Confirm the tag points to the correct commit.
  ```bash
  git show v0.2.0 --stat | head -5
  ```

## Post-Release: Verification

- [ ] Confirm `dist/index.js` in the tagged commit is the intended entrypoint.
- [ ] Confirm `action.yml` in the tag references `dist/index.js` as `main`.
- [ ] Smoke-test a maintainer-published release tag or commit SHA using the monorepo action path `TrustSignal-dev/TrustSignal/github-actions/trustsignal-verify-artifact`.
- [ ] Update the README examples only after the chosen stable ref policy is documented and published.

## Marketplace Publication (when applicable)

Normal workflow consumption should use the monorepo subdirectory path:

`TrustSignal-dev/TrustSignal/github-actions/trustsignal-verify-artifact`

Public ref policy: pin to a maintainer-published release tag or commit SHA. Stable major tags are not currently guaranteed.

GitHub Marketplace publication is a separate packaging concern. Marketplace requires the action repository to have `action.yml` at the repository root. If Marketplace publication is needed later, follow these steps:

1. Extract `github-actions/trustsignal-verify-artifact/` into a dedicated public repository.
2. Place `action.yml`, `dist/index.js`, `README.md`, and `LICENSE` at the repository root.
3. Push a version tag to the public repository.
4. Use GitHub's **Draft a release** flow to publish to the Marketplace.
5. Link the Marketplace listing from this monorepo's documentation, but keep the monorepo as the source of truth unless governance changes explicitly.

---

_See `CONTRIBUTING.md` for local validation commands._
