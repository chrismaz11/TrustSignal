# Codex Implementation Prompt

## Context
Repository: $REPO
Stack: $STACK
Service: $SERVICE

This repository operates under SOC2 / Vanta compliance guardrails.

## Goal
Implement the following feature:

$FEATURE

## Security Requirements
- Never hardcode secrets
- Use environment variables
- Use OAuth2 or OIDC for authentication
- Enforce TLS for all services
- Do not log PII or tokens
- Follow least-privilege IAM

## Implementation Requirements
- Maintain existing architecture
- Follow repository lint rules
- Add unit tests
- Ensure backward compatibility

## Files Likely To Change
$FILES

## Validation
Run:

```bash
npm test
npm run lint
npm run build
```
