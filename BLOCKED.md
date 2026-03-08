# BLOCKED

Date: 2026-03-08
Repo: `TrustSignal-dev/TrustSignal`
Branch: `master`

## Open blockers

### 1) Historical secret-remediation closure is still incomplete (high risk)

Current state:
- Tracked secrets were removed from the current tree and history rewrite/remediation work was previously performed.
- Formal credential-rotation evidence and GitHub-side hidden ref purge confirmation are still not closed out.

Required unblock:
- Finish credential rotation evidence capture.
- Confirm hidden `refs/pull/*` retention cleanup with GitHub support.

### 2) HTTPS/TLS ingress evidence is still incomplete (high risk)

Current state:
- Runtime HTTPS guards exist in code.
- Staging/production ingress evidence for forwarded HTTPS headers and certificate/TLS policy is still missing.

Required unblock:
- Capture edge TLS evidence for the deployed API surface.
- Attach evidence to the governance tracker.

### 3) Monitoring and alert evidence is still incomplete (medium risk)

### 4) Prisma 7 upgrade is only completed for `apps/api` (medium risk)

Current state:
- `apps/api` now runs on Prisma 7 using `@prisma/adapter-pg`, `pg`, and `apps/api/prisma.config.ts`.
- Legacy root `src/` paths were decoupled from direct Prisma type imports so they do not block the upgrade.
- The repo-wide `typecheck` gate is still red because of pre-existing `apps/web` generated-type/import drift, not the Prisma migration.

Required unblock:
- Repair the `apps/web` import/type drift so repo-wide `tsc -b` is green again.
- Decide whether the root legacy Prisma usage should also be migrated to Prisma 7 or isolated behind its own package boundary.

Current state:
- Metrics/status endpoints and baseline monitoring docs exist.
- Staging alert deployment and fired/resolved alert evidence are still missing.

Required unblock:
- Deploy alert rules/dashboard configuration.
- Capture alert fire/resolution evidence.

## Verified controls

- `master` branch protection is active:
  - required PR reviews: `1`
  - required checks: `lint`, `typecheck`, `test`, `rust-build`
  - required signatures: enabled
  - conversation resolution: enabled
  - admin enforcement: enabled
- Repository guardrails are present in `AGENTS.md`, API override instructions, middleware override instructions, and CI security workflow checks.
