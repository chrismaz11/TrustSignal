# AGENTS.md

## Repository Operating Policy

This repository is developed using AI coding agents (Codex) and must remain compliant with security practices required for SOC 2 readiness and Vanta monitoring.

All changes must preserve:

- security
- auditability
- least privilege
- secure secret management
- deterministic builds

If a request conflicts with these requirements, the agent must refuse the request and propose a compliant alternative.

---

# Engineering Guardrails

## Secrets & Credentials

Never introduce or expose:

- API keys
- OAuth tokens
- refresh tokens
- passwords
- private keys
- session cookies

Secrets must never appear in:

- source code
- configuration files committed to git
- logs
- stack traces

Use one of the following instead:

- environment variables
- platform secret managers
- vault systems

Examples:

Allowed:
process.env.API_KEY

Not allowed:
const API_KEY = "123abc"

---

# Encryption Requirements

Sensitive data must always be protected.

Required standards:

Transport encryption:
TLS 1.2 or higher

Data at rest:
AES-256 or equivalent managed encryption

Sensitive data includes:

- authentication tokens
- user identifiers
- email addresses
- payment data
- documents or uploaded files

Never transmit sensitive data over plaintext HTTP.

---

# Authentication Standards

Use only established authentication systems:

Allowed:

- OAuth2
- OpenID Connect (OIDC)
- SAML
- managed identity providers

Do not implement:

- custom cryptography
- custom token algorithms
- home-grown password hashing

Use trusted libraries for authentication.

---

# Logging & Auditability

Security-relevant actions must produce structured logs.

Required logging fields:

- timestamp
- actor or service identity
- action performed
- target resource
- request ID
- success or failure result

Logs must never contain:

- tokens
- passwords
- private keys
- session cookies
- raw PII

Sensitive fields must be masked or redacted.

---

# Principle of Least Privilege

All infrastructure and services must use minimal access permissions.

Examples:

Prefer scoped permissions:

s3:GetObject
s3:PutObject

Avoid wildcard permissions:

admin:*
*

Service accounts, database users, and API tokens must only have permissions required for their task.

---

# Dependency Security

When introducing dependencies:

- prefer actively maintained packages
- pin dependency versions
- avoid deprecated libraries

All repositories should support vulnerability scanning through CI.

Recommended tools:

- Dependabot
- Snyk
- OSV scanner

---

# Infrastructure Practices

Preferred architecture patterns:

Infrastructure as code:
Terraform or Pulumi

Container security:
run containers as non-root users

Secrets management:
cloud secret manager or vault system

Networking:
HTTPS-only external services

---

# Data Handling Rules

Never log or expose:

- authentication tokens
- session identifiers
- cookies
- personal user data
- encryption keys

Sensitive values must be redacted in logs and error messages.

---

# Codex Behavior Rules

Before making code changes the agent must:

1. Identify trust boundaries
2. Identify secrets and PII involved
3. Identify authentication and authorization surfaces
4. Identify compliance-sensitive areas (logging, storage, integrations)

When implementing changes:

- prefer minimal diffs
- maintain backward compatibility
- avoid introducing security regressions
- add tests where appropriate

---

# Completion Requirements

After completing work the agent must provide:

1. List of files modified
2. Summary of security impact
3. Validation steps
4. Commands required to run tests
5. Any remaining security risks

---

# Refusal Rule

If asked to perform an insecure action, including:

- storing secrets in code
- bypassing authentication
- logging sensitive data
- disabling security checks

the agent must:

1. refuse the request
2. explain why it violates security requirements
3. propose a secure alternative

---

# Compliance Awareness

This repository is expected to support compliance monitoring tools such as Vanta.

All code changes must preserve evidence generation for:

- authentication logs
- infrastructure changes
- CI/CD execution logs
- security scans
