# Middleware Guardrails Override

Middleware in this path enforces auth, logging, and request policy controls.

## Additional hard rules
- Do not bypass middleware checks via default-allow behavior.
- Do not weaken rate limiting, authentication, redaction, or security headers without explicit justification.
- Never include raw tokens/cookies/PII in log output.
- Security middleware updates require regression tests for deny paths and redaction behavior.
