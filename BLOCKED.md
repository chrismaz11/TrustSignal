# BLOCKED

Date: 2026-03-08
Repo: `TrustSignal-dev/TrustSignal`
Branch: `cm/fix-breaking-dependabot-batch`

## Open blockers

### 1) Prisma 7 is not a drop-in upgrade (hard blocker)

Current state:
- Dependabot PR `#17` upgrades `@prisma/client` to `7.4.2`, but the repo still uses the Prisma 5/6 model.
- Prisma 7 rejects the current schema datasource form (`url = env("DATABASE_URL")`) and requires the new Prisma 7 configuration flow.
- The API runtime is still wired around the existing generated client path and has not yet been migrated to the Prisma 7 adapter/client bootstrap.

Required unblock:
- Add `prisma.config.ts` and move datasource URL handling out of `schema.prisma`.
- Migrate runtime client initialization to the Prisma 7-supported configuration/adapter model.
- Validate the API build and tests on Node 22 in CI and locally before reopening the upgrade.

### 2) ESLint 10 is blocked by the current lint plugin stack (medium risk)

Current state:
- Dependabot PR `#19` upgrades `eslint` to `10.0.3`.
- The current stack uses `eslint-plugin-import@2.32.0`, which only declares support through ESLint 9.
- `@typescript-eslint` can be moved forward, but the repo still needs a lint-plugin strategy that preserves current lint behavior.

Required unblock:
- Either replace `eslint-plugin-import` with a compatible supported alternative or defer ESLint 10 until the plugin ecosystem catches up.
- Re-run `lint`, `typecheck`, and `test` after the lint-stack decision.

### 3) Historical secret-remediation closure is still incomplete (high risk)

Current state:
- Tracked secrets were removed from the current tree and history rewrite/remediation work was previously performed.
- Formal credential-rotation evidence and GitHub-side hidden ref purge confirmation are still not closed out.

Required unblock:
- Finish credential rotation evidence capture.
- Confirm hidden `refs/pull/*` retention cleanup with GitHub support.

### 4) HTTPS/TLS ingress evidence is still incomplete (high risk)

Current state:
- Runtime HTTPS guards exist in code.
- Staging/production ingress evidence for forwarded HTTPS headers and certificate/TLS policy is still missing.

Required unblock:
- Capture edge TLS evidence for the deployed API surface.
- Attach evidence to the governance tracker.

### 5) Monitoring and alert evidence is still incomplete (medium risk)

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
- Consolidated Halo2/governance integration is already merged to `master` via PR `#13`.
- Repository guardrails are present in `AGENTS.md`, API override instructions, middleware override instructions, and CI security workflow checks.
