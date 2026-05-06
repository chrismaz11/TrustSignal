# TrustSignal Repo Roles

This file is the source of truth for canonical ownership and repo-role labels across the TrustSignal repo family.

## Canonical Ownership

| Surface | Source of truth |
|---|---|
| Canonical public frontend | `v0-signal-new` |
| Canonical demo site | `v0-demo` |
| Canonical backend/API | `TrustSignal/apps/api` in `TrustSignal` |
| Public docs ownership | `v0-signal-new` for live public docs; `TrustSignal/docs` for implementation and maintainer documentation |
| Canonical GitHub Action | `TrustSignal/github-actions/trustsignal-verify-artifact` |

## Repo Roles

| Repo | Role | Expected status |
|---|---|---|
| `TrustSignal` | Canonical product monorepo and backend ownership | `canonical` `active` |
| `v0-signal-new` | Canonical public website, onboarding surface, and live public docs → trustsignal.dev | `canonical` `active` |
| `v0-demo` | Demo site → demo.trustsignal.dev | `canonical` `active` |
| `TrustSignal-App` | GitHub App backend for webhook intake and check publishing | `active` |
| `TrustSignal-docs` | Secondary sanitized public review package | `secondary` `public-review` |
| `trustagents` | Experimental R&D repository outside the production verification path | `experimental` `active` |
| `TrustSignal-Reddit` | Adjacent product repository → reddit.trustsignal.dev | `active` `adjacent-product` |
| `TrustSignal-Verify-Artifact` | Deprecated standalone action repository kept for history and migration | `deprecated` `archived` |

## Deprecated Repos

- `TrustSignal-Verify-Artifact` is deprecated.
- New installs and documentation must point to `TrustSignal/github-actions/trustsignal-verify-artifact`.

## Status Definitions

- `canonical`: authoritative source for that surface.
- `active`: maintained and in current use.
- `pilot-only`: limited pilot or internal-use surface; not a general public source of truth.
- `experimental`: R&D or evaluation surface outside the production trust path.
- `deprecated`: retained temporarily for migration or reference; no new integrations should start here.
- `archived`: historical read-only surface.

Additional qualifiers such as `secondary`, `public-review`, and `adjacent-product` may be used when they do not conflict with the definitions above.
