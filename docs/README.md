# TrustSignal Documentation Index

This folder is organized into active, canonical documents and archived historical material.

## Problem

TrustSignal documentation is written for evaluators and implementers working in workflows where later auditability matters. The main attack surface is not only bad data at intake, but also tampered evidence, provenance loss, artifact substitution, and stale evidence that cannot be verified later.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer that returns signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability for existing workflow integration.

## Demo

Start with the local developer trial if you want the fastest technical evaluation:

- [5-minute developer trial](/Users/christopher/Projects/trustsignal/demo/README.md)

The demo shows artifact hashing, verification, signed receipt issuance, later verification, and tampered artifact mismatch detection without external services.

## Integration

Start here if you want to evaluate the public verification lifecycle quickly:

- [Partner evaluation overview](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)
- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [Postman collection](/Users/christopher/Projects/trustsignal/postman/TrustSignal.postman_collection.json)
- [Postman local environment](/Users/christopher/Projects/trustsignal/postman/TrustSignal.local.postman_environment.json)

Golden path:

1. submit a verification request
2. receive verification signals plus a signed verification receipt
3. retrieve the stored receipt
4. run later verification

## Technical Details

## Integration Fit

The evaluator and demo paths are deliberate evaluator paths. They show the verification lifecycle safely before production integration and do not remove production security requirements.

## Production Deployment Requirements

Local development defaults are intentionally constrained and fail closed where production trust assumptions are not satisfied. Production deployment requires explicit authentication, signing configuration, and environment setup.

## Canonical Documentation
- `final/01_EXECUTIVE_SUMMARY.md`
- `final/02_ARCHITECTURE_AND_BOUNDARIES.md`
- `final/03_SECURITY_AND_COMPLIANCE_BASELINE.md`
- `final/04_OPERATIONS_AND_SUPPORT.md`
- `final/05_API_AND_INTEGRATION_GUIDE.md`
- `final/06_PILOT_AND_MARKETPLACE_READINESS.md`
- `final/07_SECRET_ROTATION_AND_HISTORY_REMEDIATION.md`
- `final/08_STAGING_SECURITY_EVIDENCE_CHECKLIST.md`
- `final/09_GITHUB_SUPPORT_PURGE_REQUEST_TEMPLATE.md`
- `final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`
- `final/11_NSF_GRANT_WHITEPAPER.md`
- `final/12_R_AND_D_LOG.md`
- `final/13_SOC2_READINESS_KICKOFF.md`
- `final/14_VANTA_INTEGRATION_USE_CASE.md`

## Governance and Security Tracking
- `PRODUCTION_GOVERNANCE_TRACKER.md`
- `SECURITY.md`
- `security-summary.md`
- `verification.md`
- `ops/monitoring/README.md`
- `../PROJECT_PLAN.md`
- `../SECURITY.md`

## Policies and Legal
- `legal/privacy-policy.md`
- `legal/terms-of-service.md`
- `legal/cookie-policy.md`
- `legal/pilot-agreement.md`

## Archive
Historical planning, synthesized source-of-truth drafts, and early notebook logs are retained under:
- `archive/legacy-2026-02-25/`

Use archived files for context only, not as current implementation guidance.
