# AI Guardrails

This repository is operated for SOC 2 / Vanta readiness. Codex work in this repo must stay secure, reviewable, and audit-friendly.

## Instruction files

Codex instructions live in these files:

- Root guidance: `AGENTS.md`
- API overrides: `api/AGENTS.override.md`
- App API overrides: `apps/api/AGENTS.override.md`
- Legacy API overrides: `src/api/AGENTS.override.md`

The root file applies repo-wide. Override files add stricter rules inside sensitive directories.

## What Codex may do

- Make the smallest viable change that satisfies the task.
- Reuse existing architecture, libraries, and CI patterns.
- Add or update tests, docs, and validation scripts where needed.
- Improve security posture when doing so does not break existing behavior.

## What Codex may not do

- Hardcode secrets, keys, passwords, private keys, cookies, or tokens.
- Return or log raw PII, secrets, session tokens, or refresh tokens.
- Disable tests, auth checks, logging, redaction, or security controls to force a task through.
- Introduce custom auth or crypto schemes when standard libraries and patterns already exist.
- Claim compliance controls that are not actually enforced by code, process, or CI.

## Required review flow

Before coding changes in auth, storage, integrations, or user-data paths, Codex must identify:

1. Trust boundaries
2. Secret and credential flows
3. PII and compliance-sensitive surfaces
4. Required redaction, auth, and audit logging behavior

Pull requests should be reviewed by a human maintainer before merge. Reviews should verify:

- The diff is minimal and scoped
- Tests cover changed behavior
- Logging stays redacted
- No secrets or sample credentials were introduced
- New dependencies are justified and maintained

AI-assisted pull requests must disclose AI usage in the PR template and receive at least one human approval. The `AI PR Review Gate` workflow is designed to be used as a required status check in branch protection.

## Required validation before merge

Run these commands from the repo root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run security:audit
```

CI should also run secret scanning on pull requests and protected branches.

## Secret handling and redaction

- Use environment variables or an approved secrets manager for sensitive values.
- Never place real secrets in source code, fixtures, docs, or screenshots.
- Do not log authorization headers, cookies, session IDs, OAuth tokens, refresh tokens, passwords, or raw PII.
- Security-relevant actions should keep structured audit logs with timestamp, actor, action, target, request ID, and result.
- The main API structured logging middleware lives at `src/middleware/logger.ts`.

## Dependency hygiene

- Prefer maintained dependencies and pinned versions consistent with the lockfile.
- Run dependency audits as part of validation.
- Keep new tooling lightweight and compatible with existing repo workflows.

## Task closeout expectation

When Codex finishes a task, the summary should include:

- Changed files
- Security impact
- Validation run
- Unresolved risks or follow-ups
