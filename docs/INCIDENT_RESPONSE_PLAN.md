# TrustSignal Incident Response Plan

This plan is the audit-facing incident response runbook for TrustSignal. It is specific to TrustSignal's verification receipts, workflow orchestration, API surface, and operational dependencies. Detailed incident records and responder notes must remain in private systems.

## Severity Levels

| Severity | Description | Response Expectation |
| --- | --- | --- |
| `P1` | Confirmed compromise of signing keys, production database, or multi-tenant trust boundary | Immediate coordination, containment first |
| `P2` | Confirmed misuse of API credentials, repository compromise, or workflow evidence tampering with customer impact | Begin response within 4 hours |
| `P3` | Suspected replay, integrity mismatch, or monitoring alert with limited blast radius | Same business day |
| `P4` | Low-risk control drift, documentation gaps, or non-exploitable hygiene issue | Next planned remediation cycle |

## Detection Sources

TrustSignal incidents can be detected through:

- GitHub Actions failures or secret-leak alerts
- security workflow findings from Trivy, dependency review, or zizmor
- API monitoring and verification lifecycle metrics
- workflow audit event review from `WorkflowEvent` persistence
- partner or user reports
- provider notifications from Vercel, Supabase, GitHub, or other infrastructure vendors

## Roles And Responsibilities

- Incident commander: coordinates triage, containment, owner assignment, and final timeline
- Engineering responder: scopes impact, deploys fixes, and preserves evidence
- Communications lead: prepares customer, partner, or regulator communication when needed
- Compliance owner: stores evidence, links remediation records, and tracks follow-up actions

## Evidence Gathering

For every incident:

1. Preserve relevant logs before destructive changes.
2. Capture the affected receipt IDs, workflow IDs, artifact IDs, and request IDs where applicable.
3. Export related `WorkflowEvent` records, verification logs, and CI run URLs.
4. Save deployment, provider, and branch-protection evidence in private compliance storage.
5. Record who performed containment and when.

## Communication Plan

- Internal: use a private incident channel and tracked incident record
- External: notify affected partners or customers after impact is confirmed and containment steps are underway
- Regulatory or contractual notifications: route through leadership and compliance review before sending

## Containment And Recovery

Containment priorities for TrustSignal:

- revoke or rotate exposed API keys, signing keys, webhook secrets, or database credentials
- stop issuance of new trust artifacts if receipt integrity is uncertain
- disable affected workflows or routes if the trust boundary is compromised
- redeploy only after verification checks and smoke tests pass

Recovery must include:

- validation of signed receipt verification paths
- review of workflow audit events for the incident window
- confirmation that branch protection and CI controls remain intact

## Post-Incident Review

Every `P1` to `P3` incident requires:

1. a written summary
2. a root-cause statement
3. corrective actions with owners
4. control updates or follow-up issues
5. evidence links stored outside the public repository

## Related Documents

- [docs/security/INCIDENT_RESPONSE.md](security/INCIDENT_RESPONSE.md)
- [docs/compliance/policies/incident-response-policy.md](compliance/policies/incident-response-policy.md)
- [docs/security-workflows.md](security-workflows.md)
- [docs/SECURITY.md](SECURITY.md)
