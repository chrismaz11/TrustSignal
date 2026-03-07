# BLOCKED

Date: 2026-03-07
Repo: `TrustSignal-dev/TrustSignal`
Branch: `master`
Primary run URL: https://github.com/TrustSignal-dev/TrustSignal/actions/runs/22797482456

## Open blockers

### 1) CI required checks still red on latest remote run (hard blocker)

Root cause is no longer billing lock. Branch protection and required contexts are active, but latest remote run is still red while local remediation has been implemented and verified.

Latest failing remote run:
- `https://github.com/TrustSignal-dev/TrustSignal/actions/runs/22797482456` (pre-remediation state)

Local remediation already implemented:
- CI workflow updated to `npm ci` and `npx` execution paths (`.github/workflows/ci.yml`).
- ZKML verifier updated to lazy-load EZKL bindings to prevent module-load failures when python path is selected (`src/verifiers/zkmlVerifier.ts`).
- Local validation passed: `npx tsc --strict --noEmit`, targeted zkML tests, and `npx vitest run --coverage`.

Required unblock:
- Push remediation commit(s) to `master`.
- Re-run required checks on `master` until all four required contexts (`lint`, `typecheck`, `test`, `rust-build`) pass.

### 2) Secret-remediation governance closure still open (high risk)

Current state:
- History rewrite and force-push were completed, but governance closure still requires:
  - credential rotation evidence package
  - GitHub Support confirmation for hidden `refs/pull/*` purge

Required unblock:
- Complete rotation evidence and attach artifacts in repo.
- Record GitHub Support purge confirmation and rerun final history scans.

## Recently resolved items

- Branch protection is now enabled on `master` with:
  - required pull requests
  - required checks (`lint`, `typecheck`, `test`, `rust-build`)
  - 1 required approving review
  - required conversation resolution
  - enforced admins
  - required signed commits
- GitHub billing lock no longer blocks workflow scheduling (jobs are running).
- `PR #8` merged to `master` and feature branch deleted.
- Remote branch cleanup completed for fully merged branches (`V2`, `work`, `deedshield-v2-risk-proof`, `codex/replace-mocked-zkp-verifier-with-halo2-rs-gadget`).
- Additional stale remotes deleted (`antigravity-backup-2026-02-21`, `dependabot/npm_and_yarn/npm_and_yarn-415ef9698e`); retained `codex/production-governance-20260222` for targeted review.
- Test root consolidation completed: canonical suite path is now `tests/` (legacy `test/` removed).
