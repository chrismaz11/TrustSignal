# TrustSignal Production Governance Tracker

Last updated: 2026-03-07
Owner: Orchestration/Governance Agent
Scope: Repository-wide (`TrustSignal`)

## Status Legend
- `NOT STARTED`
- `IN PROGRESS`
- `IMPLEMENTED`
- `VERIFIED IN TEST`
- `VERIFIED IN STAGING`

## Production Gate
- Current gate: `BLOCKED`
- Reason:
  - 2026-03-07 governance blocker: CI remediation PR `#11` has all required checks passing (`https://github.com/TrustSignal-dev/TrustSignal/actions/runs/22801575144`), but merge is blocked by base-branch policy pending required review approval.
  - 2026-03-07 governance hardening completed: `master` branch protection is now active (PR required, 1 approval, required checks, conversation resolution, admin enforcement, signed commits); see `docs/evidence/security/github-governance-2026-03-07.md`.
  - Historical secret exposure remediation is still open for governance closure: history rewrite and force-push are complete, but hidden `refs/pull/*` retention purge confirmation and credential-rotation evidence are still pending (tracking issue `https://github.com/TrustSignal-dev/TrustSignal/issues/4`).
  - TLS 1.3/HTTPS enforcement is implemented in code, but staging/prod ingress evidence is still missing (`x-forwarded-proto=https` forwarding + certificate policy proof; `TASKS.md` P1-S2 unchecked item).
  - Monitoring/alerting governance remains incomplete: baseline alert/dashboard artifacts are now defined in-repo, but staging deployment and fired/resolved alert evidence are still pending (`TASKS.md` P1-S3 unchecked item).

## Critical Week 1 Roadmap
| Item | Status | Evidence | Blocker |
|---|---|---|---|
| Remove `.env` secrets from git history | `IN PROGRESS` | Current tracked secret files removed from index on 2026-02-25; history rewrite + force-push completed; ignore rules hardened in root `.gitignore`; local placeholders provided via `.env.example` | Finalize GitHub Support purge for hidden `refs/pull/*` and complete rotation evidence package (`TASKS.md` P1-S1) |
| JSON/Zod validation on all API endpoints | `VERIFIED IN TEST` | Route schema hardening in `apps/api/src/server.ts`; validation and auth test coverage in `apps/api/src/security-hardening.test.ts` | Staging verification + OpenAPI parity still pending in Workstream #9 |
| Per-API-key rate limiting | `VERIFIED IN TEST` | `apps/api/src/server.ts`, `apps/api/src/security-hardening.test.ts` | Needs staging verification under load |
| PostgreSQL + TLS DB path | `VERIFIED IN STAGING` | Datasource set to `postgresql` in `apps/api/prisma/schema.prisma`; migration history under `apps/api/prisma/migrations/`; `prisma migrate deploy` + API tests pass against local PostgreSQL; Vercel staging probe (`sslmode=require`) at `docs/evidence/staging/vercel-staging-2026-02-27.md`; Supabase DB control evidence at `docs/evidence/staging/supabase-db-security-2026-02-27.md` | Promote same controls and recurring evidence collection in production |
| TLS certificates / HTTPS in production | `VERIFIED IN TEST` | HTTPS runtime guard in `apps/api/src/server.ts`; coverage in `apps/api/src/security-hardening.test.ts` | Need staging/prod ingress attestations (TLS cert chain, TLS1.3 policy, `x-forwarded-proto` forwarding) |

## 13 Workstream Checklist
| # | Workstream | Status | Evidence | Remaining Gate |
|---|---|---|---|---|
| 1 | Rate limiting per `Organization.apiKey` + 429 logging | `VERIFIED IN TEST` | `apps/api/src/server.ts`, `apps/api/src/security-hardening.test.ts` | Staging soak + abuse test |
| 2 | HTTPS/TLS 1.3 everywhere | `IN PROGRESS` | Runtime HTTPS rejection in `apps/api/src/server.ts`; validation coverage in `apps/api/src/security-hardening.test.ts`; TLS guidance in `docs/final/04_OPERATIONS_AND_SUPPORT.md`; Vercel staging TLS/API probe artifact at `docs/evidence/staging/vercel-staging-2026-02-27.md` | Need explicit edge TLS policy + forwarded proto configuration attestations and production certificate lifecycle evidence |
| 3 | PostgreSQL + encryption-at-rest + TLS DB | `VERIFIED IN STAGING` | Production DB guard in `apps/api/src/server.ts`; datasource/migration path is PostgreSQL (`apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`); evidence capture script in `scripts/capture-supabase-db-security-evidence.sh`; local dry-run artifact at `docs/evidence/db-security/staging-local-20260222T150912Z.md`; Vercel staging probe at `docs/evidence/staging/vercel-staging-2026-02-27.md`; Supabase SSL/encryption/TLS session evidence at `docs/evidence/staging/supabase-db-security-2026-02-27.md` | Replicate and attest production environment controls |
| 4 | Vault-backed secret management + rotation | `IN PROGRESS` | Deployment and local secret handling controls in `.env.example`, `apps/api/.env.example`, and runtime env enforcement in `apps/api/src/server.ts` | Not full secret inventory, no rotation automation evidence |
| 5 | Trust registry detached signature verification | `VERIFIED IN TEST` | `apps/api/src/registryLoader.ts`, `apps/api/src/v2-integration.test.ts`; 2026-03-07 note: Registry Wave 1 adapters are seeded in `TASKS.md` MVP10 (`openfema_nfip_community`, `gleif_lei_records`) with fail-closed negative tests in `apps/api/src/registry-adapters.test.ts` | Staging key-rotation drill + adapter health attestations in staging/prod |
| 6 | ATTOM/OpenAI circuit breakers + safe degradation | `IN PROGRESS` | ATTOM breaker in `apps/api/src/services/attomClient.ts`; OpenAI timeout/fallback in `apps/api/src/services/compliance.ts` | No unified breaker/backoff policy on all outbound paths |
| 7 | Multi-provider RPC failover + health checks | `IN PROGRESS` | Portability stubs in `packages/core/src/anchor/portable.ts` | No production failover path in `apps/api/src/anchor.ts` |
| 8 | Monitoring + alerting (Prometheus/Grafana + SLO alerts) | `IN PROGRESS` | `/api/v1/status` and `/api/v1/metrics` implemented in `apps/api/src/server.ts`; incident/escalation and SLO baseline documented in `docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`; monitoring rollout artifacts added in `docs/ops/monitoring/alert-rules.yml` and `docs/ops/monitoring/grafana-dashboard-deedshield-api.json`; staging endpoint evidence at `docs/evidence/staging/vercel-staging-2026-02-27.md` | Deploy rules/dashboard in staging and provide alert fire/resolution artifacts (screenshots + config exports) |
| 9 | Strict JSON/Zod on every public endpoint + OpenAPI parity | `IN PROGRESS` | Route schema + no-body enforcement in `apps/api/src/server.ts`; tests in `apps/api/src/security-hardening.test.ts` | OpenAPI parity and conformance tests remain incomplete |
| 10 | Multi-organization isolation (no cross-tenant access) | `VERIFIED IN TEST` | Ownership checks in `apps/api/src/server.ts`; tests in `apps/api/src/v2-integration.test.ts` | Staging adversarial test suite |
| 11 | Smart contract governance (audit readiness, multisig, pause) | `VERIFIED IN TEST` | `packages/contracts/contracts/AnchorRegistry.sol`, tests in `packages/contracts/test/AnchorRegistry.test.js` | Third-party audit completion + deployment governance evidence |
| 12 | Retention, DPIA hooks, user rights (`access/erasure/portability`) | `IN PROGRESS` | Retention fields exist in `apps/api/prisma/schema.prisma`; revoke endpoint present | No 90-day job, export/erasure endpoints, or DPIA workflow evidence |
| 13 | Incident runbooks + real `status.deedshield.io` | `IN PROGRESS` | Incident/escalation baseline documented in `docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`; legacy runbook retained at `docs/archive/legacy-2026-02-25/ops/incident-response.md` | No live status-page implementation evidence or operator drill artifact |

## Dated Notes
- 2026-03-07: `BLOCKED.md` is the source of truth for active governance blockers (PR merge approval gate + remaining secret-remediation closure).
- 2026-03-07: Registry adapter Wave 1 is complete per `TASKS.md` MVP10 and is not a production gate blocker at this time.
- 2026-03-07: Branch protection and governance evidence capture completed via `scripts/apply-github-branch-protection.sh` and `scripts/capture-github-governance-evidence.sh`.
- 2026-03-07: Local CI remediation verification passed (`npx tsc --strict --noEmit`, `npx vitest run --coverage`); session evidence recorded in `notebooks/governance-ci-unblock-2026-03-07.ipynb`.
- 2026-03-07: PR `#11` remediation checks are green (`lint`, `typecheck`, `test`, `rust-build`), awaiting required approval before merge into `master`.

## Hard Security Blocks (Non-Negotiable)
1. `BLOCK`: Secrets in git or history.
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
