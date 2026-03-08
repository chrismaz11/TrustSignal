# AI Guardrails for Codex in TrustSignal

## Purpose
This document defines how Codex should operate in this repository so AI-generated changes remain secure, reviewable, and audit-friendly for SOC 2 and Vanta readiness.

## Policy files and precedence
- `AGENTS.md` (repo root): baseline guardrails for all paths.
- `AGENTS.override.md` (nested directories): stricter controls for sensitive scopes.
- The closest policy file to a changed file takes precedence.

## What Codex is allowed to do
- Implement minimal, scoped changes aligned with requested outcomes.
- Add/update tests for modified behavior, especially security-sensitive flows.
- Improve security controls where gaps are identified.
- Update docs and CI checks to improve evidence collection.

## What Codex must not do
- Hardcode or expose secrets, tokens, passwords, private keys, cookies, or raw PII.
- Disable auth, logging, linting, tests, or security checks to make work pass.
- Introduce non-standard auth/crypto implementations.
- Make broad unrelated refactors in sensitive codepaths.

## Review flow for AI-generated PRs
1. Confirm changed files are in scope for the requested task.
2. Validate trust boundaries and sensitive data paths affected.
3. Verify auth, redaction, and least-privilege assumptions still hold.
4. Confirm CI checks passed (lint, tests, secret scan, dependency audit).
5. Ensure unresolved risks are documented before merge.

## Required validation before merge
- Run lint and test suites.
- Run secret scanning.
- Run dependency audit for production dependencies.
- For auth/logging changes, run targeted regression tests for deny paths and redaction.

## Secret handling and logging redaction
- Load sensitive config from environment variables or approved secret managers.
- Never print secret values in logs, error responses, telemetry, or test snapshots.
- Redact sensitive fields at middleware boundaries and in structured logs.

## Dependency hygiene
- Use maintained libraries.
- Pin versions when practical.
- Review vulnerability audit results and remediate high/critical findings before release.
