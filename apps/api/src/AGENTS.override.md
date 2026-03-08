# API Service Guardrails Override

This directory handles authentication, request processing, and user/business data. Apply stricter controls than root policy.

## Additional hard rules
- Never return raw auth tokens, credentials, or PII in API responses, error payloads, or logs.
- Error messages must be sanitized and must not leak internals (queries, keys, stack traces).
- Any auth or authorization change must include failure-path tests and access-boundary tests.
- Any logging change must preserve redaction of secrets and PII.
- Changes must be minimal and high-confidence; avoid broad refactors in the same diff as security-sensitive edits.

## Mandatory validation for changes in this scope
- Run targeted tests covering auth failures and authorization boundaries.
- Verify logs and error payloads redact sensitive fields.
