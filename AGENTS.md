# TrustSignal AI Engineering Guardrails

## Compliance posture
This repository is operated for SOC 2 readiness and Vanta-aligned evidence collection. Every change must preserve security controls, auditability, least privilege, and deterministic CI evidence.

## Hard rules
- Never hardcode secrets, API keys, OAuth tokens, refresh tokens, passwords, private keys, or session cookies.
- Never emit sensitive values or raw PII in logs, stack traces, telemetry, or test fixtures.
- Use environment variables or an approved secret manager for all sensitive configuration.
- Use standards-based auth (OAuth 2.0/OIDC/JWT with vetted libraries); do not invent custom cryptography.
- Require TLS 1.2+ for all network paths carrying sensitive data.
- Preserve structured audit logs for security-relevant events (timestamp, actor/service, action, target, request_id, result).
- Enforce least privilege for IAM roles, service accounts, DB permissions, and API scopes.
- Do not disable auth checks, logging, tests, linting, or security controls to make a task pass.
- Prefer maintained dependencies and pin versions where practical.

## Required workflow for AI-generated changes
Before coding:
1. Identify trust boundaries.
2. Identify secrets/PII touched by the task.
3. Identify compliance-sensitive surfaces (auth, storage, logging, third-party integrations).
4. Propose the safest minimal implementation.

During implementation:
- Keep diffs small and reviewable.
- Add or update tests for security-critical behavior.
- Preserve backward compatibility unless a migration is explicitly included.

When finishing:
- Summarize files changed.
- Summarize security impact.
- List validation commands run and outcomes.
- Call out unresolved risks or control gaps.

## Refusal rule
If a request is insecure or non-compliant (for example: exposing secrets, bypassing auth, logging PII, or weakening controls), refuse the unsafe approach and provide a safer alternative immediately.
