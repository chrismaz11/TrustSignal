# TrustSignal GitHub Settings Checklist

> Codex can add repository files and workflows, but it cannot safely click or verify GitHub repository settings from inside the repo. After this PR lands, verify the settings below in GitHub.

Short description:
This checklist separates what TrustSignal now manages in-repo from the GitHub settings that still require manual verification in the repository UI.

Audience:
- repository administrators
- security reviewers
- engineering leads

## In-Repo Automation

The repository now manages these controls in code:

- Dependabot configuration in `.github/dependabot.yml`
- dependency diff review in `.github/workflows/dependency-review.yml`
- repository vulnerability scanning in `.github/workflows/trivy.yml`
- workflow hardening review in `.github/workflows/zizmor.yml`
- weekly and push-based repository score tracking in `.github/workflows/scorecard.yml`
- review hygiene defaults in `.github/pull_request_template.md`

Not yet managed in-repo:

- `CODEOWNERS`, because repository-specific GitHub usernames or team slugs should not be guessed

## Manual GitHub Settings Still Required

### 1. Actions

Verify in GitHub:
- GitHub Actions is enabled for the repository
- workflow permissions remain restricted to the default least-privilege mode unless a specific workflow requires more
- branch and environment secrets are reviewed for necessity and rotated if stale

### 2. Dependency Graph And Dependabot

Verify in GitHub:
- Dependency graph is enabled
- Dependabot alerts are enabled
- Dependabot security updates are enabled if supported by the repository plan
- Dependabot version updates are allowed for this repository

### 3. Secret Scanning

Verify in GitHub:
- secret scanning is enabled if the repository type and plan support it
- push protection is enabled if available and acceptable for the team workflow

Note:
- secret scanning availability depends on repository visibility and GitHub plan

### 4. Code Scanning / CodeQL

Recommended manual setup:
- enable code scanning in GitHub Security
- prefer GitHub CodeQL default setup unless you have a clear reason to maintain advanced CodeQL workflow YAML in-repo

Reason:
- this repo already uploads third-party SARIF from Trivy and Scorecard
- CodeQL default setup is usually the safer and lower-maintenance starting point for JavaScript/TypeScript repositories

### 5. Branch Protection Or Rulesets

Configure branch protection or a repository ruleset for `master`:

- require pull requests before merge
- require at least one human PR review
- dismiss stale approvals when new commits are pushed if that matches team policy
- disable force pushes to `master`
- disable branch deletion on `master`
- restrict direct pushes to `master`
- optionally require branches to be up to date before merge
- add a real `CODEOWNERS` file later if the repository has stable maintainer usernames or org team slugs

Recommended baseline for this repository:

- `required_approving_review_count = 1`
- `strict = true`
- required status checks:
  - `lint`
  - `typecheck`
  - `test`
  - `secret-scan`
  - `dependency-audit`
  - `signed-receipt-smoke`

Evidence to capture after configuration:

- one `gh api` or GitHub UI export showing branch protection enabled on `master`
- one screenshot showing the required status checks list
- one screenshot or JSON export showing force pushes and deletions disabled

### 6. Required Status Checks

After the workflows have run successfully on `master`, consider requiring these checks before merge:

- `typecheck`
- `web-build`
- `test`
- `signed-receipt-smoke`
- `messaging-check` when docs or web copy changes matter
- `Dependency diff review`

Optional later:

- `Trivy repository scan` after the advisory rollout proves low-noise
- `zizmor advisory audit` for workflow-change pull requests if branch rulesets can scope that requirement safely

Advisory only by default:

- `OpenSSF Scorecard analysis`

## What To Verify After Merge

1. Open the repository `Settings` and `Security` tabs in GitHub.
2. Confirm every workflow appears under Actions and is enabled.
3. Confirm Dependabot is creating update PRs on the expected schedule.
4. Confirm the Security tab shows dependency graph, Dependabot alerts, and code scanning as enabled where supported.
5. Add the required status checks only after at least one successful run for each target check.
6. Save one redacted screenshot or `gh api` response showing the final `master` branch protection settings in private compliance evidence storage.

## Example Verification Command

```bash
gh api /repos/TrustSignal-dev/TrustSignal/branches/master/protection
```

## Related Documentation

- [Security workflows](security-workflows.md)
- [Security summary](security-summary.md)
- [Documentation index](README.md)
