# TrustSignal SOC 2 Readiness Report

Generated: 2026-03-13T00:32:03.795Z

> This report is an internal readiness snapshot aligned to SOC 2 Security criteria. It is intended for planning and gap remediation. It is not an audit opinion and does not imply SOC 2 certification.

## Overall Readiness Score

71%

## Category Scores

| Category | Score | Notes |
| --- | --- | --- |
| Access Control | 2 / 3 | Repository documentation covers branch protection and review expectations, but in-repo evidence does not prove completed access reviews or enforced GitHub settings. |
| Infrastructure Security | 2 / 3 | Repository-level security workflows exist for dependency review, Trivy, and Scorecard, but infrastructure controls still require manual verification outside the repo. |
| Secure Development | 3 / 3 | Pull request review guidance and security-focused CI checks provide strong repository-level secure development coverage for a readiness baseline. |
| Monitoring | 1 / 3 | The repository can generate a security posture snapshot and retain CI scan outputs, but ongoing production monitoring evidence is not proven by repository files alone. |
| Secrets Management | 2 / 3 | TrustSignal guidance prohibits hardcoded secrets and uses environment-based configuration, but rotation cadence and vault evidence are not yet captured in this framework. |
| Incident Response | 2 / 3 | A formal policy template exists, but exercised incident records, communication drills, and post-incident evidence are not yet included. |
| Data Protection | 2 / 3 | Data handling and retention guidance now exists, but applied retention schedules and production evidence still need to be collected. |
| Compliance Documentation | 3 / 3 | The repository contains a structured readiness framework, policy templates, and generated reporting suitable for a mock-audit baseline. |

## Recommended Remediation Items

- Access Control: Capture recurring access review evidence for GitHub and production systems.
- Access Control: Enable and verify branch protection or rulesets with required reviews on main.
- Infrastructure Security: Document environment hardening baselines and infrastructure ownership.
- Infrastructure Security: Capture operational evidence for backup, recovery, and hosted-service security settings.
- Monitoring: Document log review cadence, alert routing, and monitored systems.
- Monitoring: Attach monitoring exports or screenshots for operational environments.
- Secrets Management: Track secret rotation ownership and review cadence.
- Secrets Management: Collect evidence that production secrets are stored and rotated using approved mechanisms.
- Incident Response: Run a tabletop exercise and retain the output.
- Incident Response: Define severity levels, contact paths, and evidence preservation procedures in operating records.
- Data Protection: Define retention windows by evidence and operational data category.
- Data Protection: Capture proof of encryption, access controls, and disposal procedures where applicable.

## Scoring Model

- 0 = missing
- 1 = partial
- 2 = implemented
- 3 = strong

## Notes

- Scores are based on repository-visible controls and documentation only.
- GitHub UI configuration, infrastructure operations, access reviews, and restore testing still require manual verification.
- This report should be refreshed when major security workflows, policies, or governance controls change.
