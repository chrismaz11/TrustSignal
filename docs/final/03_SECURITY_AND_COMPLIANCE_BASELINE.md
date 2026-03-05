# Security and Compliance Baseline

## Security Objectives
- Prevent secret exposure and enforce rotation discipline.
- Enforce API trust boundaries and tenant isolation.
- Enforce transport and database encryption controls in deployed environments.
- Prevent PII leakage in logs, responses, and anchors.

## Required Controls
- Secrets and config: environment variables only, no sensitive material in Git.
- API protections: authentication, validation, rate limiting, safe error handling.
- Data protections: minimal retention, access controls, and auditable deletion behavior.
- Crypto protections: standard algorithms and vetted libraries only.

## Evidence Standard
Security and compliance claims require reproducible evidence:
- test evidence for code-level controls
- staging evidence for infrastructure-level controls
- operational evidence for monitoring, incident response, and key procedures

## Source of Record
- `../PRODUCTION_GOVERNANCE_TRACKER.md`
- `../SECURITY.md`
- `../../SECURITY.md`
- `../legal/*.md` for policy/legal language
