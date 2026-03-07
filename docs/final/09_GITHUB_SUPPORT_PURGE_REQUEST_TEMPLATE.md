# GitHub Support Purge Request Template

## Subject
Request purge of sensitive objects retained in hidden pull refs (`refs/pull/*`) after history rewrite

## Repository
`TrustSignal-dev/TrustSignal`

## Request
We performed a history rewrite and force-push across branch and tag refs to remove sensitive file paths:
- `.env.local`
- `attestations.sqlite`
- `packages/core/registry/registry.private.jwk`

Heads/tags are clean, but mirror scans still find these objects due hidden pull refs (`refs/pull/*`) and retained object storage.

Please perform GitHub-side purge of these object IDs and any associated hidden pull refs/cached objects:
- `2d239e462726f70ad3a5ca94a4be61c74260b276` (`.env.local`)
- `516126607eac213de5fb00e4ed9ca0803fc2b289` (`attestations.sqlite`)
- `1097df2baaddeec7b4ed1da59b259986b8f5d043` (`packages/core/registry/registry.private.jwk`)
- `bbba39beeb74c479a5e32b4ee01575704cab007e` (`attestations.sqlite`)

## Evidence
- Local evidence doc: `docs/evidence/security/history-remediation-2026-02-25.md`
- Rewrite date: 2026-02-25
- Canonical refs force-updated successfully.

## Confirmation Requested
Please confirm when hidden refs/cached objects are purged so we can validate with:
```bash
git rev-list --all --objects | rg '(^| )(.env.local|attestations.sqlite|packages/core/registry/registry.private.jwk)$'
```
