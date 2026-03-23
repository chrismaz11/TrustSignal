# TrustSignal Enterprise Audit Runbook

Last updated: 2026-03-19

## Scope

This runbook documents the validation surface currently present in the TrustSignal repository and how to execute it for external technical diligence. It is intentionally conservative. A passing local run is repository evidence, not an audit opinion and not a substitute for staging or production operational evidence.

## Evidence classes

### Repo-provable evidence

These checks can be executed from the repository and produce direct technical evidence:

| Command | What it proves | Diligence themes |
| --- | --- | --- |
| `npm ci` | Clean dependency install from lockfile, workspace bootstrap, postinstall build of `packages/core` | secure development, change management, dependency hygiene |
| `npm run lint` | Static policy enforcement across JS/TS sources | secure development, change management |
| `npm run typecheck` | TypeScript consistency across workspace projects | secure development, API contract correctness |
| `npm run build` | Releasable workspace artifacts can be produced | change management, reliability/availability |
| `npx vitest run --coverage --reporter=json --outputFile=<file>` | Root unit/integration coverage for legacy auth/logging/rate-limit core | auth/access enforcement, logging/redaction, reliability/availability |
| `cd apps/api && npx vitest run --reporter=json --outputFile=<file>` | API lifecycle, auth, scopes, tenant isolation, redaction, revocation, schema, health/status hardening | auth/access enforcement, tenant isolation, logging/redaction, API contract correctness, reliability/availability |
| `cd apps/web && npx vitest run --reporter=json --outputFile=<file>` | Web utility tests execute under repo state | secure development |
| `cd circuits/non_mem_gadget && cargo test --message-format=json` | Rust/Halo2 verifier tests compile and pass | secure development, reliability/availability |
| `bash scripts/history-secret-scan.sh` | No blocked secret file paths were found in Git object history | secure development, dependency hygiene |
| `gitleaks git . --redact --no-banner` | Secret-scanning over repository history and current tree | secure development |
| `npm audit --omit=dev --audit-level=high` | Production dependency vulnerability posture from npm advisory data | dependency hygiene |
| `npm ls --omit=dev --all --json` | Machine-readable production dependency inventory | dependency hygiene |

### CI-provable evidence

These controls exist in the repository or GitHub workflow configuration, but require GitHub Actions execution context or repository settings to fully prove:

| Evidence source | What it covers | Diligence themes |
| --- | --- | --- |
| `.github/workflows/ci.yml` | lint, typecheck, root coverage tests, web build, signed-receipt smoke, Rust build/tests, gitleaks, npm audit | secure development, change management, auth/access enforcement, dependency hygiene |
| `.github/workflows/scorecard.yml` | OSSF Scorecard SARIF and supply-chain review in GitHub | secure development, dependency hygiene, change management |
| `scripts/smoke-signed-receipt.sh` | signed receipt smoke path in CI with PostgreSQL | API contract correctness, reliability/availability |

### Manual operational evidence required

These items are not provable from a local repository run alone:

| Evidence item | Why local repo evidence is insufficient | Diligence themes |
| --- | --- | --- |
| Staging TLS and ingress behavior | Requires deployed endpoint, certificate chain, and redirect behavior | reliability/availability |
| Production database TLS and encryption at rest | Requires database provider and runtime configuration evidence | auth/access enforcement, reliability/availability |
| Access reviews, RBAC review records, IAM exports | Operational control evidence lives outside the repo | auth/access enforcement, change management |
| Monitoring exports, alert delivery, on-call evidence | Docs exist, but live telemetry and alert evidence are external | logging/redaction, incident readiness, reliability/availability |
| Backup/restore proof | Restore drills and provider snapshots are not in-repo artifacts | backup/recovery evidence |
| Incident tabletop evidence | Policies and runbooks exist, but exercise evidence is external | incident readiness |
| Secret rotation proof | Repo can show scanning, not proof of external credential rotation | dependency hygiene, secure development |
| Combined `trustagents` or external oracle integration evidence | Not wired and exercised in this repository run | API contract correctness, reliability/availability |

## High-value targeted regressions

These are the repo checks that best map to KPMG-style technical diligence themes:

| Area | Current check |
| --- | --- |
| Unauthorized requests rejected | `apps/api/src/security-hardening.test.ts` |
| Invalid scopes rejected | `apps/api/src/security-hardening.test.ts` |
| Malformed payloads rejected | `apps/api/src/request-validation.test.ts` |
| Logging redaction | `tests/middleware/logger.test.ts` |
| Cross-tenant isolation | `apps/api/src/v2-integration.test.ts` |
| Revocation behavior | `apps/api/src/v2-integration.test.ts`, `tests/api/routes.test.ts` |
| Receipt immutability and tamper detection | `tests/integration/fullBundle.test.ts`, `tests/e2e/verify-negative.test.ts` |
| Fail-closed proof/registry behavior | `tests/e2e/verify-negative.test.ts`, `apps/api/src/registry-adapters.test.ts` |
| Rate limiting | `tests/middleware/rateLimit.test.ts`, `apps/api/src/security-hardening.test.ts`, `apps/api/test/rate-limit.test.ts` |
| Health/status sensitive-state leakage | `apps/api/src/health-endpoints.test.ts` |
| Missing required env/config | `apps/api/src/env.test.ts`, `apps/api/src/security-hardening.test.ts`, `tests/middleware/auth.test.ts` |

## Existing staging and operational capture scripts

These scripts are useful for follow-on diligence once a deployed environment is available:

| Script | Purpose | Evidence class |
| --- | --- | --- |
| `scripts/capture-staging-evidence.sh` | HTTP, HTTPS redirect, ingress forwarding probes | manual operational evidence required |
| `scripts/capture-vercel-staging-evidence.sh` | Deployed API health/status probes | manual operational evidence required |
| `scripts/capture-db-security-evidence.mjs` | DB TLS, redacted URL, Prisma migration status | manual operational evidence required |
| `scripts/capture-vanta-integration-evidence.sh` | Deployed Vanta schema and verification endpoint capture | manual operational evidence required |
| `scripts/capture-github-governance-evidence.sh` | GitHub branch protection and governance evidence | manual operational evidence required |

## Current local rerun notes

- The repository shell sandbox blocked local artifact writes inside the repo, so this run stored machine-generated artifacts under `/tmp/kpmg-readiness-20260319T191111Z`.
- The local Node runtime was `v22.14.0` while `package.json` declares `20.x`. `npm ci` completed with an engine warning; this should be normalized in a controlled diligence environment.
- Do not present this run as proof that `trustagents` or any external oracle has been integrated into TrustSignal. That evidence was not produced here.
