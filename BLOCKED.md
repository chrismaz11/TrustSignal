# BLOCKED

Date: 2026-03-08
Repo: `TrustSignal-dev/TrustSignal`
Branch: `master`

## Open blockers

### 1) Release attestation prover is not production-ready (hard blocker)

Current state:
- The release `zkp_service` binary builds successfully and setup material exists in `circuits/non_mem_gadget/keys/`.
- The toy combined non-membership/revocation Criterion benchmark still reports roughly `1.9 ms`, but that is not the document-hash attestation circuit used by the external prover path.
- Running the ignored release attestation tests shows the real SHA-256 document proof path running past 60 seconds.
- A direct release `zkp_service` prove attempt using the baked sample attestation payload returned `The constraint system is not satisfied`, so correctness and latency both need more work before this can be presented as production-grade.

Required unblock:
- Reproduce the failing release `zkp_service` prove path with a deterministic harness and isolate whether the sample payload or the SHA-256 attestation circuit is at fault.
- Either optimize the attestation circuit materially (lookup-table strategy / reduced witness surface) or pivot to a faster hash/circuit design such as Poseidon for the commitment statement while preserving auditability.
- Only after release prove/verify succeeds reliably should proof-latency evidence be captured for partner-facing claims.

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

### 6) Prisma 7 upgrade is only completed for `apps/api` (medium risk)

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
- Consolidated Halo2/governance integration is already merged to `master` via PR `#13`.
- Repository guardrails are present in `AGENTS.md`, API override instructions, middleware override instructions, and CI security workflow checks.
