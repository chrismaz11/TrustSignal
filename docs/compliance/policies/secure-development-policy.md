# TrustSignal Secure Development Policy

> This public policy is intentionally high level. Tool-specific configurations, sensitive findings, and operational review records must remain in private compliance systems.

## Purpose

Establish secure software development expectations for TrustSignal so code changes are reviewed, tested, and released with documented security considerations.

## Scope

This policy applies to application code, infrastructure-as-code, CI/CD workflows, dependency changes, scripts, and public-facing documentation that could affect security posture or trust claims.

## Responsibilities

- Engineers follow secure coding standards and document security-relevant assumptions.
- Reviewers assess security impact, dependency risk, and claims-boundary implications.
- Maintainers ensure CI validation remains effective and least-privilege automation is preserved.
- Leadership prioritizes remediation of material security findings.

## Control Procedures

1. Changes are introduced through reviewable pull requests unless a documented emergency process applies.
2. Security-sensitive changes receive explicit reviewer attention for auth, secrets, logging, dependency, and workflow risks.
3. Build and typecheck validation should pass before merge for changes affecting shipping code.
4. Dependency updates are reviewed with automated tooling where available.
5. Secrets, tokens, private keys, and raw PII must not be committed to the repository.
6. Documentation must not overstate security, compliance, or production guarantees beyond available evidence.

## Evidence

Evidence for this policy must be stored in Vanta, internal compliance storage, or a private audit repository rather than in this public repository.
