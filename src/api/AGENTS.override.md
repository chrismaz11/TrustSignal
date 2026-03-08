# Sensitive Directory Override

This directory contains legacy API handlers and is treated as compliance-sensitive.

Additional rules:

- Do not return raw tokens, cookies, secrets, session identifiers, or PII in responses, errors, logs, or test snapshots.
- Redact sensitive headers, credentials, and request payload fields before logging.
- Preserve or improve auth checks, access control checks, request validation, and rate limiting.
- Keep diffs minimal and high confidence. Do not mix unrelated refactors into API security changes.
- Add or update tests for auth failures, access control, input validation, and redaction behavior whenever these paths change.
- If a change affects trust boundaries, document the new boundary and the expected audit trail in the task summary.
