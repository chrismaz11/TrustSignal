# TrustSignal Security Workflows

> TrustSignal uses a minimal set of security-focused GitHub Actions workflows to scan the repository, review dependency changes, and harden workflow configuration over time.

## Overview

These workflows are intended to add practical security coverage without introducing broad permissions or noisy initial rollout behavior.

## Trivy Filesystem Scan

Workflow:
- `.github/workflows/security-trivy.yml`

What it does:
- scans the repository filesystem with Trivy
- focuses on `HIGH` and `CRITICAL` vulnerabilities
- ignores unfixed issues to reduce early noise
- uploads SARIF results for review

When it runs:
- on every pull request
- on pushes to `main`

How to interpret failures:
- this workflow starts in advisory mode and does not fail the job on findings
- review SARIF/code scanning results for actionable `HIGH` or `CRITICAL` issues
- on forked pull requests, SARIF upload may be skipped because GitHub does not grant `security-events: write` to untrusted fork tokens

Mode:
- advisory

## OpenSSF Scorecard

Workflow:
- `.github/workflows/security-scorecard.yml`

What it does:
- runs OpenSSF Scorecard against the repository
- uploads SARIF results
- publishes results through the standard Scorecard-supported path

When it runs:
- on pushes to `main`
- weekly on schedule

How to interpret failures:
- failures usually indicate workflow/configuration issues, permissions issues, or a Scorecard execution problem
- review the SARIF upload and workflow logs first

Mode:
- advisory by default unless later enforced through branch protection or policy

## zizmor Workflow Audit

Workflow:
- `.github/workflows/security-zizmor.yml`

What it does:
- audits GitHub Actions workflows for common security issues
- emits annotations and log findings

When it runs:
- only when files under `.github/workflows/**` change

How to interpret failures:
- the workflow is intentionally advisory and uses `continue-on-error`
- findings should still be reviewed and fixed, but they do not block merges at this stage

Mode:
- advisory

## Dependency Review

Workflow:
- `.github/workflows/security-dependency-review.yml`

What it does:
- reviews dependency diffs on pull requests
- fails if a pull request introduces `high` or `critical` vulnerabilities through dependency changes

When it runs:
- on pull requests

Support note:
- GitHub Dependency Review is supported for public repositories and for private repositories with GitHub Advanced Security

How to interpret failures:
- a failing result means the dependency diff introduced vulnerable dependencies at or above the configured threshold
- review the dependency review summary in the workflow run before merging

Mode:
- blocking

## Permission Model

These workflows follow a least-privilege approach:

- `contents: read` is used where repository checkout or metadata access is required
- `security-events: write` is granted only to SARIF-publishing workflows
- `id-token: write` is granted only to Scorecard because publishing results requires it
- no workflow uses broad write permissions or repository secrets

## Operational Guidance

- Treat Trivy and zizmor as early-warning signals during rollout.
- Treat Dependency Review as the primary blocking dependency-diff control.
- Review Scorecard results over time for repository hardening trends rather than expecting every check to be perfect immediately.
