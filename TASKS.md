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
- [ ] Perform git history rewrite for historical secret exposure and force-push sanitized refs.
- [x] Validate rewrite workflow in mirror clone (`scripts/rewrite-history-remove-sensitive-paths.sh`).
- [x] Add full-history blocked-path scan (`scripts/history-secret-scan.sh`).
- [x] Publish rotation/history remediation runbook (`docs/final/07_SECRET_ROTATION_AND_HISTORY_REMEDIATION.md`).
- [x] Rewrite and force-push sanitized branch/tag refs to GitHub canonical remote.
- [ ] Open GitHub Support request to purge hidden `refs/pull/*` object retention and confirm final full-history clean scan. Tracking issue: `https://github.com/chrismaz11/TrustSignal/issues/4`

### P1-S2 Staging Security Evidence
- [x] Deploy Vercel preview with Supabase-backed PostgreSQL (`sslmode=require`) and capture API/TLS probe evidence (`docs/evidence/staging/vercel-staging-2026-02-27.md`).
- [ ] Collect staging evidence for PostgreSQL TLS and encrypted-at-rest controls.
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

### P1-S5 Session 6 Hardening (TrustSignal Runtime)
- [x] Add structured JSON API logging middleware with request metadata and sensitive-data redaction.
- [x] Harden JWT authentication with rotating key support (`TRUSTSIGNAL_JWT_SECRETS`).
- [x] Add adversarial ZKML test suite (`tests/adversarial/zkml_adversarial.test.ts`).
- [x] Raise scoped API runtime coverage above 90% with enforced Vitest thresholds.
- [x] Add GitHub Actions CI workflow (`.github/workflows/ci.yml`) for lint, strict typecheck, coverage tests, and Rust build/tests.
- [x] Publish OWASP audit and threat model deliverables (`security/audit_report.md`, `security/threat_model.md`).

## Phase 2 — ICE/Encompass Marketplace Ready
- [ ] Draft integration contract for Encompass-facing flows.
- [ ] Define idempotency, retry, and error semantics.
- [ ] Build integration validation suite and readiness report.
- [ ] Assemble marketplace submission packet.

## Phase 3 — Long-Term Hardening
- [ ] Key management uplift plan (KMS/HSM).
- [ ] Dependency and supply-chain hardening controls.
- [ ] Deferred advanced feature hardening (real ZKP, portability).
