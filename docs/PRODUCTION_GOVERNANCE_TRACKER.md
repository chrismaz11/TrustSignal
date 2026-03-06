# TrustSignal Production Governance Tracker

Last updated: 2026-02-27
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
  - Historical secret exposure still requires formal rotation evidence and final GitHub-side purge confirmation: tracked secret files were removed from the current index on 2026-02-25 (`.env.local`, `attestations.sqlite`, `packages/core/registry/registry.private.jwk`), branch/tag history was rewritten and force-pushed, but hidden `refs/pull/*` retention still requires platform support cleanup.
  - PostgreSQL migration is complete in test and now verified in staging with Supabase SSL enforcement + root-key presence + live TLS session evidence (`docs/evidence/staging/supabase-db-security-2026-02-27.md`); production control attestation package still pending.
  - TLS 1.3/HTTPS enforcement is implemented in code, but staging/prod ingress evidence is still missing (`x-forwarded-proto=https` forwarding + certificate policy proof).
  - Monitoring/alerts/status-page controls are not implemented.

## Critical Week 1 Roadmap
| Item | Status | Evidence | Blocker |
|---|---|---|---|
| Remove `.env` secrets from git history | `IN PROGRESS` | Current tracked secret files removed from index on 2026-02-25; ignore rules hardened in root `.gitignore`; local placeholders provided via `.env.example` | Must rewrite history, rotate all exposed credentials, and document rotation evidence |
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
| 5 | Trust registry detached signature verification | `VERIFIED IN TEST` | `apps/api/src/registryLoader.ts`, `apps/api/src/v2-integration.test.ts` | Staging key-rotation drill |
| 6 | ATTOM/OpenAI circuit breakers + safe degradation | `IN PROGRESS` | ATTOM breaker in `apps/api/src/services/attomClient.ts`; OpenAI timeout/fallback in `apps/api/src/services/compliance.ts` | No unified breaker/backoff policy on all outbound paths |
| 7 | Multi-provider RPC failover + health checks | `IN PROGRESS` | Portability stubs in `packages/core/src/anchor/portable.ts` | No production failover path in `apps/api/src/anchor.ts` |
| 8 | Monitoring + alerting (Prometheus/Grafana + SLO alerts) | `IN PROGRESS` | `/api/v1/status` and `/api/v1/metrics` implemented in `apps/api/src/server.ts`; incident/escalation and SLO baseline documented in `docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`; staging endpoint evidence at `docs/evidence/staging/vercel-staging-2026-02-27.md` | Implement dashboard/alert rules and provide alert fire/resolution artifacts (screenshots + config exports) |
| 9 | Strict JSON/Zod on every public endpoint + OpenAPI parity | `IN PROGRESS` | Route schema + no-body enforcement in `apps/api/src/server.ts`; tests in `apps/api/src/security-hardening.test.ts` | OpenAPI parity and conformance tests remain incomplete |
| 10 | Multi-organization isolation (no cross-tenant access) | `VERIFIED IN TEST` | Ownership checks in `apps/api/src/server.ts`; tests in `apps/api/src/v2-integration.test.ts` | Staging adversarial test suite |
| 11 | Smart contract governance (audit readiness, multisig, pause) | `VERIFIED IN TEST` | `packages/contracts/contracts/AnchorRegistry.sol`, tests in `packages/contracts/test/AnchorRegistry.test.js` | Third-party audit completion + deployment governance evidence |
| 12 | Retention, DPIA hooks, user rights (`access/erasure/portability`) | `IN PROGRESS` | Retention fields exist in `apps/api/prisma/schema.prisma`; revoke endpoint present | No 90-day job, export/erasure endpoints, or DPIA workflow evidence |
| 13 | Incident runbooks + real `status.deedshield.io` | `IN PROGRESS` | Runbook exists at `docs/archive/legacy-2026-02-25/ops/incident-response.md` | Runbook is outdated; no live status-page implementation evidence |

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
