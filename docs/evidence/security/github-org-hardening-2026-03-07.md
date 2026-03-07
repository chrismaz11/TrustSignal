# GitHub Org Hardening Evidence

Date: 2026-03-07  
Organization: `TrustSignal-dev`  
Operator: `chrismaz11` (via `gh` CLI/API)

## Scope

Configure GitHub organization and repository controls for Vanta-aligned evidence, with repo scope limited to:

- `TrustSignal-dev/TrustSignal`
- `TrustSignal-dev/v0-interface-trustsignal`

## Completed Actions

1. Repository scope enforcement
- Transferred `chrismaz11/TrustSignal` to `TrustSignal-dev/TrustSignal`.
- Transferred `chrismaz11/v0-interface-trustsignal` to `TrustSignal-dev/v0-interface-trustsignal`.
- Verified org contains exactly the two repositories above.

2. Organization member privileges
- Set `members_can_create_repositories=false`.
- Set `members_can_create_public_repositories=false`.
- Set `members_can_create_private_repositories=false`.

3. Branch protection and security controls (public repo)
- Applied branch protection on `TrustSignal-dev/TrustSignal` branch `master`:
  - PR required
  - `required_approving_review_count=1`
  - `dismiss_stale_reviews=true`
  - `enforce_admins=true`
  - `required_conversation_resolution=true`
  - signed commits enabled
- Enabled:
  - Dependabot alerts
  - Automated security fixes
  - Secret scanning
  - Secret scanning push protection

4. Security controls (private repo)
- Enabled on `TrustSignal-dev/v0-interface-trustsignal`:
  - Dependabot alerts
  - Automated security fixes

## Blocked / Not Applied

1. Org-wide 2FA requirement
- Attempted to set `two_factor_requirement_enabled=true`.
- Current state remains `false`.
- Manual follow-up required in GitHub UI: `Organization Settings -> Authentication security -> Require two-factor authentication`.

2. Restrict member visibility changes
- Attempted API update for `members_can_change_repo_visibility=false`.
- Current state remains `true`.
- Manual follow-up required in GitHub UI: `Organization Settings -> Member privileges`.

3. Branch protection on private repo
- Applying branch protection on `v0-interface-trustsignal/main` returned `HTTP 403`:
  - "Upgrade to GitHub Pro or make this repository public to enable this feature."
- Signed commit protection on that private repo is blocked by the same plan constraint.

4. Advanced Security on private repo
- Enabling Advanced Security returned `HTTP 422`:
  - "Advanced security has not been purchased."

5. Optional Vanta custom property
- Attempt to create org custom property `vanta_production_branch_name` returned `HTTP 404` (feature unavailable on current org tier/feature set).

## Final Verification Snapshot

- Org repos: `TrustSignal`, `v0-interface-trustsignal`
- Org setting:
  - `members_can_create_repositories=false`
  - `members_can_create_public_repositories=false`
  - `members_can_create_private_repositories=false`
  - `members_can_change_repo_visibility=true` (manual follow-up)
  - `two_factor_requirement_enabled=false` (manual follow-up)
- `TrustSignal/master`: protected + signed commits + review controls active
- `v0-interface-trustsignal/main`: branch protection blocked by plan, Dependabot controls active
