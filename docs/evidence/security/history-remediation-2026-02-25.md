# History Remediation Evidence (2026-02-25)

## Objective
Remove historical occurrences of:
- `.env.local`
- `attestations.sqlite`
- `packages/core/registry/registry.private.jwk`

## Actions Performed
1. Removed tracked sensitive files from current index in working branch.
2. Validated rewrite workflow in local mirror clone.
3. Performed force-rewrite push against GitHub canonical remote (`TrustSignal`) for branch and tag refs.

## Results
### Heads/Tags
Scan command:
```bash
git rev-list --objects --branches --tags | rg '(^| )(.env.local|attestations.sqlite|packages/core/registry/registry.private.jwk)$'
```
Result: no matches in rewritten heads/tags.

### Hidden Pull Refs
GitHub remote still exposes hidden pull refs in mirror fetches:
- `refs/pull/1/head`
- `refs/pull/2/head`
- `refs/pull/3/head`

Full `--all` scan in a mirror clone still returns blocked path objects because these hidden pull refs cannot be updated/deleted by normal push permissions.

## Remaining Blocker
GitHub-side cleanup is required for hidden pull refs and object retention.

## Required Follow-up
- Open GitHub Support request to purge sensitive objects from hidden PR refs and cached object storage.
- After support confirmation, re-run full scan:
```bash
git rev-list --all --objects | rg '(^| )(.env.local|attestations.sqlite|packages/core/registry/registry.private.jwk)$'
```
- Attach support ticket ID and final clean scan output to governance tracker.

## Tracking
- GitHub issue opened to track support request and closure steps:
  - https://github.com/TrustSignal-dev/TrustSignal/issues/15
- GitHub Support purge request submitted on 2026-03-16:
  - Evidence artifact: `docs/evidence/security/github-support-purge-request-2026-03-16.md`
  - Template used: `docs/final/09_GITHUB_SUPPORT_PURGE_REQUEST_TEMPLATE.md`
  - Status: **SUBMITTED — Awaiting GitHub Support Confirmation**
