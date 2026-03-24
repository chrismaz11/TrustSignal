# Security and Secrets

## Secret handling
- Do not commit secrets, credentials, or tokens to this repository.
- Use local `.env` files for development secrets and keep them untracked.
- If a secret is committed, rotate it immediately and remove it from git history.
- Private key material (for example `*.private.jwk`) must never be tracked.

## Blocked files
The pre-commit hook rejects:
- Home directory artifacts (Pictures/, Music/, Movies/, Library/, Documents/, Desktop/, .ssh/, .gnupg/, Google Drive/)
- Secret-like files (`*.pem`, `*.key`, `credentials*.json`, `*token*`, `*.env`, `.env.*`, `*.private.jwk`, `*.sqlite`)

## Baseline repository guardrails
- `.gitignore` blocks local env files and SQLite artifacts (`.env*`, `**/*.sqlite`).
- `packages/core/registry/registry.private.jwk` is intentionally untracked.
- Use `.env.example` placeholders for setup documentation; never store real credentials in examples.

## Reporting
If you discover a secret leak, notify the repo owner and rotate the credential.

## Related Response Documentation

- [Incident Response Plan](INCIDENT_RESPONSE_PLAN.md)
- [Security workflows](security-workflows.md)
