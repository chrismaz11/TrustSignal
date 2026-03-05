# SOC 2 Readiness Kickoff (TrustSignal)

Last updated: 2026-03-05  
Owner: Engineering / Security

## Objective

Start and maintain a documented SOC 2 readiness path suitable for partner due diligence and Vanta ecosystem review.

## Current Status

- Kickoff initiated in-repo on 2026-03-05.
- Existing controls and evidence are tracked in:
  - `docs/PRODUCTION_GOVERNANCE_TRACKER.md`
  - `docs/final/03_SECURITY_AND_COMPLIANCE_BASELINE.md`
  - `docs/final/08_STAGING_SECURITY_EVIDENCE_CHECKLIST.md`
  - `docs/final/10_INCIDENT_ESCALATION_AND_SLO_BASELINE.md`

## Scope (Initial)

- API security controls and logging hygiene
- Access control and key management process maturity
- Change management and incident response evidence
- Availability and monitoring baseline

## 30-60-90 Plan

### 0-30 days
- Define SOC 2 system boundary and trust service criteria mapping.
- Establish control owner matrix (engineering, security, operations).
- Consolidate evidence locations and collection cadence.
- Stand up Vanta workspace baseline (policy/control inventory + integrations).

### 31-60 days
- Run control gap assessment against current implementation.
- Implement missing controls with evidence-first tracking.
- Execute first internal control walkthrough for change management and access reviews.

### 61-90 days
- Perform readiness check and remediate high-severity gaps.
- Freeze evidence package for auditor scoping discussion.
- Confirm timeline for formal attestation engagement.

## Deliverables

- SOC 2 boundary statement and control mapping
- Evidence collection calendar and accountable owners
- Gap register with remediation dates
- Readiness report (go / no-go for audit window)

## Guardrails

- Do not claim SOC 2 certification until an independent audit is completed.
- Keep all compliance claims evidence-backed and date-stamped.
