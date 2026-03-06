# TrustSignal Project Plan

Last updated: 2026-02-25
Primary goal: production-ready TrustSignal verification platform with a clear path to ICE Mortgage Technology / Encompass marketplace integration.

## 1. Purpose and Success Criteria
- Deliver a secure, stable verification platform that title companies and lenders can run in pilot with low operational risk.
- Produce the integration, security, and operational artifacts required for ICE/Encompass marketplace readiness.
- Preserve useful existing work (security controls, verification flows, pilot docs) while de-prioritizing speculative features that do not unblock pilot or marketplace acceptance.

Success criteria:
- Pilot gates pass with staging evidence, not just local test evidence.
- ICE/Encompass integration contract, implementation, and validation pack are complete.
- Security and operations controls are demonstrably enforced in production-like environments.

## 2. Current Baseline (Consolidated)
- Source-of-truth and legal/compliance docs consistently describe a simulator-first posture and strict boundaries.
- Security posture has strong in-repo controls, but production gate remains blocked on infra evidence and operational controls.
- Documentation has drift and duplication:
  - duplicated architecture summaries in canonical docs and legacy docs
  - mixed SQLite-vs-PostgreSQL assumptions across docs
  - mixed anchor network defaults across older docs/notebooks
  - old and new API contracts documented in parallel

## 3. Phase 1: Pilot-Ready for Title Companies and Lenders
Objective: move from "verified in test" to "verified in staging/pilot operations."

In scope:
- Close production gate blockers in the governance tracker:
  - secrets hygiene and rotation evidence
  - PostgreSQL TLS/encryption attestation in staging
  - HTTPS ingress proof (cert chain, TLS policy, forwarded proto behavior)
  - baseline monitoring/alerts/status surface
- Stabilize critical API paths:
  - verify/receipt/revoke behavior and schema consistency
  - strict request validation and auth on all public paths
  - cross-tenant isolation regression coverage
- Pilot operations package:
  - updated pilot handbook + title user guide
  - incident response runbook updated to current architecture
  - data retention/destruction controls mapped to implemented jobs/config

Out of scope:
- advanced ZKP and multi-chain portability work not required for pilot safety

Deliverables:
- Pilot Readiness Checklist (evidence-backed)
- Staging Evidence Bundle (security + reliability)
- Pilot Runbook Pack (ops, incident, support escalation)

Exit gate:
- Pilot Go/No-Go signoff from product + engineering + security owner.

## 4. Phase 2: ICE/Encompass Marketplace-Ready
Objective: make integration and operations package acceptable for marketplace onboarding.

In scope:
- Integration contract and adapter behavior:
  - API contract for Encompass-facing flows
  - auth, idempotency, error semantics, retry behavior, versioning policy
  - eventing/webhook behavior and failure handling
- Marketplace documentation package:
  - installation/configuration guide
  - operational support model and escalation SLAs
  - security questionnaire response set and architecture packet
  - legal/policy docs aligned to real deployed behavior
- Reliability and release controls:
  - SLOs, dashboards, alerts, status endpoint/page
  - rollback and incident drills
  - reproducible release checklist and evidence archive

Out of scope:
- non-essential feature expansion that does not improve integration reliability or acceptance

Deliverables:
- ICE/Encompass Integration Specification
- Marketplace Submission Pack
- Integration Test and Reliability Report

Exit gate:
- Marketplace Submission Ready review completed with no unresolved P1 blockers.

## 5. Phase 3: Longer-Term Hardening and Refactors
Objective: harden for scale and reduce long-term operational/security risk after integration readiness.

In scope:
- Key management uplift (KMS/HSM path and rotation automation)
- Supply-chain hardening and dependency governance
- Architecture/documentation cleanup:
  - remove duplicate/stale docs
  - enforce a single canonical API contract and architecture source
- Deferred advanced features (only after business-critical readiness):
  - real ZKP implementation (replace mock)
  - portability/multi-chain expansion
  - deeper fraud analytics and OCR-assisted checks

Deliverables:
- GA Hardening Roadmap and completion evidence
- Refactor plan with migration and rollback notes

Exit gate:
- GA Hardening Complete signoff with audited controls and stable operations.

## 6. Cross-Phase Non-Negotiable Gates
- No secrets in code or git history; rotation evidence for all previously exposed credentials.
- No cross-tenant access paths.
- No production DB deployment without TLS and encrypted-at-rest verification.
- No undocumented public API behavior differences between implementation and docs.
- No PII or sensitive payload leakage in logs or on-chain anchors.

## 7. Workstream Priority Order
1. Security and reliability blockers.
2. Pilot operability and support readiness.
3. ICE/Encompass integration contract and validation.
4. Marketplace package completeness and release discipline.
5. Post-marketplace hardening and refactors.

## 8. Source Mapping (Keep, Update, De-Prioritize)
Keep and actively use:
- `docs/PRODUCTION_GOVERNANCE_TRACKER.md`
- `SECURITY.md`
- `docs/verification.md`
- `docs/final/01_EXECUTIVE_SUMMARY.md`
- `docs/final/02_ARCHITECTURE_AND_BOUNDARIES.md`
- `docs/final/03_SECURITY_AND_COMPLIANCE_BASELINE.md`
- `docs/final/04_OPERATIONS_AND_SUPPORT.md`
- `docs/final/05_API_AND_INTEGRATION_GUIDE.md`
- `docs/final/06_PILOT_AND_MARKETPLACE_READINESS.md`
- `docs/legal/*.md`

Update/merge into canonical plan and current architecture reality:
- `docs/README.md`
- `docs/archive/README.md`
- duplicated architecture summaries in root and legacy docs

De-prioritize until Phase 3:
- items in `docs/archive/legacy-2026-02-25/notebook/deedshield_v2_notebook.md` requiring mock-to-real ZKP conversion or portability expansion
- older lab notebook implementation details in `docs/archive/legacy-2026-02-25/lab-notebook/*` except where they provide concrete test evidence needed for audit trails

## 9. Execution Cadence
- Weekly governance review against phase exit gates.
- Each major workstream must provide:
  - design/risk delta
  - minimal code diff
  - tests (happy + abuse/failure)
  - ops documentation updates
  - evidence artifact references
