# BLOCKED

Date: 2026-03-08
Repo: `TrustSignal-dev/TrustSignal`
Branch: `cm/integration-halo2-governance-20260308`

## Open blockers

### 1) Consolidated integration branch is not merged to `master` (hard blocker)

The production-oriented Halo2/ZKP work and the SOC 2 governance guardrails now live together on
`cm/integration-halo2-governance-20260308`, but `master` does not yet contain that integrated
baseline.

Current state:
- Local integration branch contains `halo2`, the PR `#12` governance guardrails, and follow-up test fixes.
- `master` branch protection is active and verified via GitHub API.
- Merge still requires a pull request, passing required checks, and at least 1 approval.

Required unblock:
- Push `cm/integration-halo2-governance-20260308`.
- Open a PR to `master`.
- Obtain required approval and merge without bypassing branch protection.

### 2) Historical secret-remediation closure is still incomplete (high risk)

Current state:
- Tracked secrets were removed from the current tree and history rewrite/remediation work was previously performed.
- Formal credential-rotation evidence and GitHub-side hidden ref purge confirmation are still not closed out.

Required unblock:
- Finish credential rotation evidence capture.
- Confirm hidden `refs/pull/*` retention cleanup with GitHub support.

### 3) HTTPS/TLS ingress evidence is still incomplete (high risk)

Current state:
- Runtime HTTPS guards exist in code.
- Staging/production ingress evidence for forwarded HTTPS headers and certificate/TLS policy is still missing.

Required unblock:
- Capture edge TLS evidence for the deployed API surface.
- Attach evidence to the governance tracker.

### 4) Monitoring and alert evidence is still incomplete (medium risk)

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
