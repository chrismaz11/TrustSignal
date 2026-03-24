# GitHub Support Purge Request — Submitted 2026-03-16

## Status
**SUBMITTED — Awaiting GitHub Support Confirmation**

## Subject
Request purge of sensitive objects retained in hidden pull refs (`refs/pull/*`) after history rewrite

## Repository
`TrustSignal-dev/TrustSignal`

## Submitted Via
GitHub Support portal: https://support.github.com/

## Request Details
We performed a history rewrite and force-push across branch and tag refs to remove sensitive file paths:
- `.env.local`
- `attestations.sqlite`
- `packages/core/registry/registry.private.jwk`

Heads/tags are clean, but mirror scans still find these objects due to hidden pull refs (`refs/pull/*`) and retained object storage.

Please perform GitHub-side purge of these object IDs and any associated hidden pull refs/cached objects:
- `2d239e462726f70ad3a5ca94a4be61c74260b276` (`.env.local`)
- `516126607eac213de5fb00e4ed9ca0803fc2b289` (`attestations.sqlite`)
- `1097df2baaddeec7b4ed1da59b259986b8f5d043` (`packages/core/registry/registry.private.jwk`)
- `bbba39beeb74c479a5e32b4ee01575704cab007e` (`attestations.sqlite`)

## Evidence References
- Template: `docs/final/09_GITHUB_SUPPORT_PURGE_REQUEST_TEMPLATE.md`
- Local evidence doc: `docs/evidence/security/history-remediation-2026-02-25.md`
- Rewrite date: 2026-02-25
- Canonical refs force-updated successfully.

## Tracking
- GitHub issue tracking this request: https://github.com/TrustSignal-dev/TrustSignal/issues/15

## Completion Criteria
Once GitHub Support confirms the purge, run the following command in a mirror clone and attach the clean output here:
```bash
git rev-list --all --objects | rg '(^| )(.env.local|attestations.sqlite|packages/core/registry/registry.private.jwk)$'
```
Expected result: **no output** (zero matches).

## Confirmation
- [ ] GitHub Support ticket opened
- [ ] GitHub Support confirmation received
- [ ] Final clean scan output attached below
- [ ] `PRODUCTION_GOVERNANCE_TRACKER.md` updated to `VERIFIED`

### Final Scan Output
_(Attach clean scan output here after GitHub Support confirms purge.)_
