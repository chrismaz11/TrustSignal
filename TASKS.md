# TrustSignal Execution Tasks

Last updated: 2026-03-08
Owner: Engineering
Plan reference: `PROJECT_PLAN.md`

## Phase 1 — Pilot Ready

### P1-S1 Security Hygiene and Secret Control
- [x] Remove tracked local secret-risk files from git index (`.env.local`, `attestations.sqlite`, `packages/core/registry/registry.private.jwk`).
- [x] Harden root `.gitignore` to block `.env*`, `*.sqlite`, and private key artifacts.
- [x] Add repository hygiene check script (`scripts/check-repo-hygiene.sh`).
- [x] Add root `.env.example` placeholders.
- [ ] Rotate all historically exposed credentials and document evidence.
- [x] Perform git history rewrite for historical secret exposure and force-push sanitized refs.
- [x] Validate rewrite workflow in mirror clone (`scripts/rewrite-history-remove-sensitive-paths.sh`).
- [x] Add full-history blocked-path scan (`scripts/history-secret-scan.sh`).
- [x] Publish rotation/history remediation runbook (`docs/final/07_SECRET_ROTATION_AND_HISTORY_REMEDIATION.md`).
- [x] Rewrite and force-push sanitized branch/tag refs to GitHub canonical remote.
- [ ] Open GitHub Support request to purge hidden `refs/pull/*` object retention and confirm final full-history clean scan.

### P1-S2 Staging Security Evidence
- [x] Deploy Vercel preview with Supabase-backed PostgreSQL (`sslmode=require`) and capture API/TLS probe evidence (`docs/evidence/staging/vercel-staging-2026-02-27.md`).
- [x] Collect staging evidence for PostgreSQL TLS and encrypted-at-rest controls (`docs/evidence/staging/supabase-db-security-2026-02-27.md`).
- [ ] Collect staging evidence for HTTPS ingress forwarding and TLS policy.
- [x] Attach evidence references to `docs/PRODUCTION_GOVERNANCE_TRACKER.md`.
- [x] Publish staging evidence checklist (`docs/final/08_STAGING_SECURITY_EVIDENCE_CHECKLIST.md`).
- [x] Add staging evidence capture script (`scripts/capture-staging-evidence.sh`).
- [x] Add Vercel-protected evidence capture script (`scripts/capture-vercel-staging-evidence.sh`).

### P1-S3 Monitoring and Operational Baseline
- [x] Implement service-level health/status reporting (`/api/v1/health`, `/api/v1/status`, `/api/v1/metrics`).
- [x] Define baseline API metrics instrumentation (`deedshield_http_requests_total`, `deedshield_http_request_duration_seconds`).
- [x] Document incident/escalation workflow aligned with current architecture (`docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`).
- [x] Define alert thresholds and dashboard/SLO targets baseline (`docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`).
- [ ] Implement dashboard and alert rules in staging monitoring stack.
- [ ] Capture alert fire/resolution evidence from staging.

### P1-S4 API Boundary Hardening
- [x] Enforce API key authentication on protected v1 endpoints.
- [x] Add issuer-gated revocation with signature verification headers.
- [x] Add rate limiting controls (`@fastify/rate-limit`) with global and per-key policies.
- [x] Replace permissive CORS with env-driven allowlist and safe production default.
- [x] Improve grantor/owner matching with normalized overlap scoring.
- [x] Remove SQLite CLI shelling from legacy `src/api` paths in favor of in-process DB access.

### P1-S5 Trust and Data-Minimization Quick Wins
- [x] Add production startup guard for `NOTARY_API_KEY`, `PROPERTY_API_KEY`, and `TRUST_REGISTRY_SOURCE`.
- [x] Replace `Receipt.rawInputs` persistence with `Receipt.rawInputsHash` (inputs commitment only).
- [x] Add Prisma migration to rename `rawInputs` to `rawInputsHash`.
- [x] Update `.env.example` files with placeholder-only verifier and trust source configuration.

### P1-S6 Vanta Partner Readiness
- [x] Add live structured verification endpoint for Vanta ingestion (`GET /api/v1/integrations/vanta/verification/:receiptId`).
- [x] Publish JSON schema endpoint for integration validation (`GET /api/v1/integrations/vanta/schema`).
- [x] Start SOC 2 readiness process documentation (`docs/final/13_SOC2_READINESS_KICKOFF.md`).
- [x] Document at least one integration pilot use case (`docs/final/14_VANTA_INTEGRATION_USE_CASE.md`).
- [x] Publish partnership pitch and demo prep package for 2026-03-06 call (`docs/partnership/vanta-2026-03-06/`).
- [ ] Capture deployed endpoint evidence (staging/production probes + payload validation logs).
- [x] Enhance endpoint evidence scripting for timeline/header/runtime placeholders (`scripts/capture-vanta-integration-evidence.sh`).

### P1-S7 Governance Gate Unblock (Mar 2026)
- [x] Implement repository guardrails and CI security checks in-repo (`AGENTS.md`, override files, docs, `.github/workflows/ci.yml`).
- [x] Verify `master` branch protection on GitHub: PR required, 1 approval, required checks, signed commits, conversation resolution, admin enforcement.
- [x] Add governance evidence capture scripts (`scripts/apply-github-branch-protection.sh`, `scripts/capture-github-governance-evidence.sh`).
- [x] Capture governance evidence and CI-required-check artifacts under `docs/evidence/security/` and `notebooks/`.
- [x] Push `cm/integration-halo2-governance-20260308` and open the consolidated integration PR to `master`.
- [x] Obtain required review approval and merge the consolidated integration PR.
- [ ] Capture fresh CI evidence tied to the consolidated integration PR after checks pass.

### P1-S8 ZKP Productionization
- [x] Remove mock-style ZKP attestation flow and secret witness key usage from active TypeScript paths.
- [x] Enforce production-only external prover flow for verifiable attestation generation.
- [x] Add canonical document commitment/public input model for document hashing.
- [x] Add Rust Halo2 service entrypoint for prove/verify bridging (`circuits/non_mem_gadget/src/bin/zkp_service.rs`).
- [x] Add tests covering dev-only guardrails, external prove path, and API/Vanta integration.
- [x] Migrate `apps/api` to Prisma 7 with adapter-backed Postgres connectivity and a separate Prisma CLI datasource config.
- [ ] Hard-pivot the document attestation circuit: current release-path SHA-256 proof generation exceeds 60s in ignored release tests and must be optimized or redesigned before claiming production readiness.
- [ ] Run end-to-end proof generation benchmarks against the real prover path and record latency evidence.
- [ ] Generate and manage proving/verifying keys for the production circuit lifecycle.

### MVP10 Registry Adapter Sprint (Mar 2026)
- [x] IL DMV adapter stub (`src/adapters/registries/il-dmv.ts`).
- [x] `registries.sql` migration (`supabase/migrations/registries.sql`).
- [x] E2E verify curl->proof test (`tests/e2e/verify.test.ts`).
- [ ] Free registry expansion backlog (next source wave prioritization and implementation queue).
- [x] Fail-closed negative tests (`apps/api/src/registry-adapters.test.ts` compliance gap coverage).

## Phase 2 — ICE/Encompass Marketplace Ready
- [ ] Draft integration contract for Encompass-facing flows.
- [ ] Define idempotency, retry, and error semantics.
- [ ] Build integration validation suite and readiness report.
- [ ] Assemble marketplace submission packet.

## Phase 3 — Long-Term Hardening
- [ ] Key management uplift plan (KMS/HSM).
- [ ] Dependency and supply-chain hardening controls.
- [ ] Deferred advanced feature hardening (real ZKP latency optimization, portability, multi-chain anchor operations).
