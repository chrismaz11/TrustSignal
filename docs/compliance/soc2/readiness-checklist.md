# TrustSignal SOC 2 Security Readiness Checklist

> This checklist is designed for mock-audit readiness reviews against SOC 2 Security criteria. It helps the team separate implemented controls from partially implemented controls and evidence that still depends on manual operations.

Short description:
Use this checklist during internal security reviews, partner diligence preparation, and pre-audit cleanup to confirm whether TrustSignal has evidence-ready controls rather than undocumented intent.

Audience:
- engineering managers
- security leads
- compliance coordinators

## Access Control

- [ ] Repository and infrastructure access is granted on least-privilege terms
- [ ] Access reviews are documented at a defined cadence
- [ ] Joiner, mover, and leaver processes are documented
- [ ] Administrative access paths are restricted and logged

## Change Management

- [ ] Pull requests are required for protected branches
- [ ] Human review is required before merge
- [ ] Required status checks are configured for mainline changes
- [ ] Emergency change procedures are documented

## Logical Security

- [ ] Secrets are stored outside the repository and rotated as needed
- [ ] Environment-specific configuration is documented
- [ ] Public-safe claims boundary is documented
- [ ] Administrative privileges are limited and reviewed

## System Monitoring

- [ ] Security-relevant CI scan outputs are retained
- [ ] Logging and monitoring expectations are documented
- [ ] Alert escalation ownership is defined
- [ ] Security findings are reviewed and triaged

## Incident Response

- [ ] Incident response policy is approved and current
- [ ] Roles and severity levels are defined
- [ ] Contact and escalation paths are documented
- [ ] Tabletop or post-incident evidence exists

## Vendor Management

- [ ] Critical vendors are inventoried
- [ ] Vendor risk review criteria are documented
- [ ] Reassessment cadence is defined
- [ ] Dependency risk is monitored continuously

## Data Protection

- [ ] Sensitive-data handling rules are documented
- [ ] Retention and disposal rules are documented
- [ ] Logging avoids raw secrets and PII
- [ ] Encryption requirements are defined where applicable

## Secure Development

- [ ] Secure development policy is documented
- [ ] Dependency updates are reviewed
- [ ] CI validation covers build and typecheck
- [ ] Security scans run on repository changes

## Risk Assessment

- [ ] A periodic security risk review exists
- [ ] Remediation items are tracked to closure
- [ ] Material system changes trigger risk review
- [ ] Readiness scoring is refreshed on a defined cadence

## Backup and Recovery

- [ ] Backup responsibilities are assigned
- [ ] Recovery procedures are documented
- [ ] Restore testing evidence exists
- [ ] Critical evidence repositories are recoverable

## Evidence Review Notes

- Repository files and CI workflows provide only partial audit evidence.
- GitHub settings, access reviews, infrastructure controls, and restore testing still require manual evidence collection.
- Generated readiness scores should be treated as internal assessment inputs, not as an audit result.

## Related Documentation

- [SOC 2 controls mapping](/Users/christopher/Projects/trustsignal/docs/compliance/soc2/controls.md)
- [SOC 2 readiness report](/Users/christopher/Projects/trustsignal/docs/compliance/soc2/readiness-report.md)
- [Policy templates](/Users/christopher/Projects/trustsignal/docs/compliance/policies)
