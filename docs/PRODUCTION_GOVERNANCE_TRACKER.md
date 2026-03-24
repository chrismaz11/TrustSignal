# TrustSignal Production Governance Tracker

Last updated: 2026-03-23
Owner: Orchestration/Governance Agent
Scope: Repository-wide (`TrustSignal`)

## Status Legend
- `NOT STARTED`
- `IN PROGRESS`
- `IMPLEMENTED`
- `VERIFIED IN TEST`
- `VERIFIED IN STAGING`
- `VERIFIED IN PRODUCTION`

## Production Gate
- Current gate: `BLOCKED`
- Reason:
  - The consolidated integration branch `cm/integration-halo2-governance-20260308` is not yet merged into `master`; this branch carries the current Halo2/ZKP baseline plus governance guardrails and is now the required review/merge unit.
  - `master` branch protection is active and verified live on GitHub as of 2026-03-08: required PRs, 1 approving review, required checks (`lint`, `typecheck`, `test`, `rust-build`), required signatures, conversation resolution, and admin enforcement.
  - Historical secret exposure remediation remains open: credential-rotation evidence is pending and GitHub Support confirmation for hidden `refs/pull/*` retention cleanup is awaiting response (support request submitted 2026-03-16; see `docs/evidence/security/github-support-purge-request-2026-03-16.md`).
  - TLS ingress evidence and monitoring/alert evidence remain incomplete for staging/production governance closure.

## Critical Week 1 Roadmap
| Item | Status | Evidence | Blocker |
|---|---|---|---|
| Consolidated governance + Halo2 branch merged to `master` | `IN PROGRESS` | Branch `cm/integration-halo2-governance-20260308`; governance guardrails in `AGENTS.md`, override files, and `.github/workflows/ci.yml`; Halo2 milestone in local `master` commit `95c87ba` | PR not yet opened/approved/merged |
| Remove `.env` secrets from git history | `IN PROGRESS` | Current tracked secret files removed from index; ignore rules hardened; remediation scripts and runbook exist; GitHub Support purge request submitted 2026-03-16 (`docs/evidence/security/github-support-purge-request-2026-03-16.md`) | Need credential rotation evidence and GitHub Support confirmation of hidden-ref/cached-object purge |
| JSON/Zod validation on all API endpoints | `VERIFIED IN TEST` | Route schema hardening in `apps/api/src/server.ts`; validation/auth test coverage | Staging verification + OpenAPI parity still pending |
| Per-API-key rate limiting | `VERIFIED IN TEST` | `apps/api/src/server.ts`, security hardening tests | Needs staging verification under load |
| PostgreSQL + TLS DB path | `VERIFIED IN STAGING` | PostgreSQL datasource/migrations in `apps/api/prisma/`; staging Vercel/Supabase DB + TLS evidence captured in `docs/evidence/db-security/staging-local-20260222T150912Z.md`; production DB encryption-at-rest evidence pending | Provider screenshots to be linked in Vanta |
| TLS certificates / HTTPS in production | `IN PROGRESS` | HTTPS runtime guard in `apps/api/src/server.ts`; staging TLS probe evidence exists | Need forwarded-proto and certificate/TLS policy evidence for deployed ingress |

## 13 Workstream Checklist
| # | Workstream | Status | Evidence | Remaining Gate |
|---|---|---|---|---|
| 1 | Rate limiting per `Organization.apiKey` + 429 logging | `VERIFIED IN TEST` | `apps/api/src/server.ts`, security hardening tests | Staging soak + abuse test |
| 2 | HTTPS/TLS 1.3 everywhere | `IN PROGRESS` | Runtime HTTPS rejection in `apps/api/src/server.ts`; staging TLS/API probe artifacts | Need explicit edge TLS policy + forwarded proto attestations and production certificate lifecycle evidence |
| 3 | PostgreSQL + encryption-at-rest + TLS DB | `VERIFIED IN PRODUCTION` | Prisma PostgreSQL path, migrations, staging DB security evidence (`docs/evidence/staging/supabase-db-security-2026-02-27.md`); production encryption-at-rest evidence captured 2026-03-23 (`docs/evidence/db-security/production-20260323T191949Z.md`): Supabase AES-256 at rest (platform default), root-key presence confirmed, TLSv1.3/AES-256-GCM live session verified | Provider screenshots and SOC 2 excerpt to be linked in Vanta and private audit repository |
| 4 | Vault-backed secret management + rotation | `IN PROGRESS` | Placeholder-only env examples and runtime env enforcement | No full secret inventory, rotation automation, or complete evidence pack |
| 5 | Trust registry detached signature verification | `VERIFIED IN TEST` | `apps/api/src/registryLoader.ts`, `apps/api/src/v2-integration.test.ts` | Staging key-rotation drill |
| 6 | ATTOM/OpenAI circuit breakers + safe degradation | `IN PROGRESS` | ATTOM breaker and compliance fallback paths | No unified breaker/backoff policy across all outbound paths |
| 7 | Multi-provider RPC failover + health checks | `IN PROGRESS` | Portability stubs in `packages/core/src/anchor/portable.ts` | No production failover path in `apps/api/src/anchor.ts` |
| 8 | Monitoring + alerting (Prometheus/Grafana + SLO alerts) | `IN PROGRESS` | `/api/v1/status`, `/api/v1/metrics`, incident/SLO docs, monitoring artifacts | Deploy alert rules/dashboard and capture fire/resolution evidence |
| 9 | Strict JSON/Zod on every public endpoint + OpenAPI parity | `IN PROGRESS` | Route schema coverage and hardening tests | OpenAPI parity and conformance tests remain incomplete |
| 10 | Multi-organization isolation (no cross-tenant access) | `VERIFIED IN TEST` | Ownership checks in `apps/api/src/server.ts`; integration tests | Staging adversarial test suite |
| 11 | Smart contract governance (audit readiness, multisig, pause) | `VERIFIED IN TEST` | `packages/contracts/contracts/AnchorRegistry.sol`, contract tests | Third-party audit completion + deployment governance evidence |
| 12 | Retention, DPIA hooks, user rights (`access/erasure/portability`) | `IN PROGRESS` | Retention fields and revoke endpoints exist | No 90-day job, export/erasure endpoints, or DPIA workflow evidence |
| 13 | Incident runbooks + real `status.deedshield.io` | `IN PROGRESS` | Incident/escalation baseline docs and legacy runbook | No live status-page implementation evidence or drill artifact |

## Dated Notes
- 2026-03-23: Production DB encryption-at-rest evidence captured. Supabase AES-256 at rest is a platform default; root-key presence confirmed (redacted); TLSv1.3/AES-256-GCM verified in live DB session. Evidence artifact: `docs/evidence/db-security/production-20260323T191949Z.md`. SECURITY_CHECKLIST.md item 2.3 updated to ✅. Provider screenshots and SOC 2 excerpt to be stored in Vanta and private audit repository.
- 2026-03-16: GitHub Support purge request submitted for hidden `refs/pull/*` retained objects (`.env.local`, `attestations.sqlite`, `packages/core/registry/registry.private.jwk`). Evidence artifact: `docs/evidence/security/github-support-purge-request-2026-03-16.md`. Awaiting confirmation to close the secret-history remediation blocker.
- 2026-03-08: `master` branch protection was verified live through GitHub API and matches the expected required-check/review policy.
- 2026-03-08: The integration baseline is now `cm/integration-halo2-governance-20260308`, not PR `#11` or PR `#12` individually.
- 2026-03-08: PR `#11` is being mined only for governance evidence/doc artifacts; runtime code from that branch is intentionally not the merge baseline.
- 2026-03-07: CI-required-check evidence was captured in `docs/evidence/security/ci-required-checks-2026-03-07.md`.
- 2026-03-07: Governance evidence artifacts were captured under `docs/evidence/security/` and `notebooks/`.

## Hard Security Blocks (Non-Negotiable)
1. `BLOCK`: Secrets in git or unresolved secret rotation.
2. `BLOCK`: Any cross-tenant read/write path.
3. `BLOCK`: Production DB path without encrypted PostgreSQL + TLS.
4. `BLOCK`: Public endpoint without strict request validation.
5. `BLOCK`: On-chain write path that could carry PII.

## Deliverable Contract for Implementation Agents
Each workstream submission must include:
1. Design doc: threat model delta + failure mode behavior + rollback.
2. Code diff: minimal, testable, no secret material.
3. Tests: unit + integration for happy path and abuse/failure path.
4. Ops docs: runbook + config matrix + alerting impact.
5. Evidence bundle: exact commands/output proving acceptance criteria.

Any missing element returns status `REJECTED` with required changes.
