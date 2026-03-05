# TrustSignal Execution Tasks

Last updated: 2026-03-02
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
- [ ] Open GitHub Support request to purge hidden `refs/pull/*` object retention and confirm final full-history clean scan. Tracking issue: `https://github.com/chrismaz11/TrustSignal/issues/4`

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
- [ ] Capture deployed endpoint evidence (staging/production probes + payload validation logs).

## Phase 2 — ICE/Encompass Marketplace Ready
- [ ] Draft integration contract for Encompass-facing flows.
- [ ] Define idempotency, retry, and error semantics.
- [ ] Build integration validation suite and readiness report.
- [ ] Assemble marketplace submission packet.

## Phase 3 — Long-Term Hardening
- [ ] Key management uplift plan (KMS/HSM).
- [ ] Dependency and supply-chain hardening controls.
- [ ] Deferred advanced feature hardening (real ZKP, portability).
