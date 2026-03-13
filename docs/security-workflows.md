# TrustSignal Security Workflows

> TrustSignal manages a minimal set of security-focused GitHub Actions workflows in-repo. These checks improve repository hygiene and visibility, but they do not replace manual GitHub settings that must still be enabled by a repository administrator.

Short description:
This document explains which security and governance controls are now defined in repository files, when they run, and how to interpret advisory versus blocking outcomes.

Audience:
- repository administrators
- security reviewers
- maintainers

## In-Repo Automation

The repository now defines these security workflows:

- `.github/workflows/dependency-review.yml`
- `.github/workflows/trivy.yml`
- `.github/workflows/scorecard.yml`
- `.github/workflows/zizmor.yml`

## Dependency Review

What it does:
- reviews dependency diffs on pull requests
- blocks only when a pull request introduces `high` or `critical` vulnerabilities through dependency changes

When it runs:
- on pull requests

Mode:
- blocking

How to interpret failures:
- a failing result means the dependency diff introduced a clearly risky dependency update
- review the dependency review summary in the GitHub workflow run before merging

## Trivy Filesystem Scan

What it does:
- scans the repository filesystem for `HIGH` and `CRITICAL` vulnerabilities
- ignores unfixed issues in the first rollout to reduce noise
- uploads SARIF results when GitHub token permissions allow it

When it runs:
- on every pull request
- on pushes to `main`

Mode:
- advisory

How to interpret failures:
- this workflow currently does not fail the job on findings
- review SARIF/code scanning results for actionable issues
- on forked pull requests, SARIF upload may be skipped because GitHub does not grant `security-events: write` to untrusted fork tokens

## OpenSSF Scorecard

What it does:
- runs OpenSSF Scorecard against the repository
- uploads SARIF results and stores the SARIF file as an artifact
- publishes Scorecard results through the supported Scorecard path

When it runs:
- on pushes to `main`
- weekly on schedule

Mode:
- advisory

How to interpret failures:
- failures usually indicate a workflow/configuration issue, a permissions problem, or a Scorecard execution issue
- review the workflow logs and SARIF upload details first

## zizmor Workflow Audit

What it does:
- audits GitHub Actions workflows for common workflow security issues
- emits annotations and logs for maintainers reviewing workflow changes

When it runs:
- only when files in `.github/workflows/**` change

Mode:
- advisory

How to interpret failures:
- findings are intentionally non-blocking during the rollout period
- maintainers should still review and address findings before merging workflow changes

## Least-Privilege Design

These workflows follow a least-privilege model:

- `contents: read` is used where checkout or repository metadata access is required
- `security-events: write` is granted only to SARIF-uploading workflows
- `id-token: write` is granted only to Scorecard because its standard publishing flow requires it
- no workflow uses `pull_request_target`
- no workflow exposes repository secrets unnecessarily

## What Is Not Controlled By Repo Files

These workflows do not automatically configure repository settings such as:

- enabling Dependency Graph
- enabling Dependabot alerts or security updates
- enabling secret scanning
- enabling CodeQL or GitHub code scanning defaults
- configuring branch protection or rulesets

Those controls still require manual verification in GitHub after merge.

## Related Documentation

- [GitHub settings checklist](/Users/christopher/Projects/trustsignal/docs/github-settings-checklist.md)
- [Security summary](/Users/christopher/Projects/trustsignal/docs/security-summary.md)
- [Documentation index](/Users/christopher/Projects/trustsignal/docs/README.md)
