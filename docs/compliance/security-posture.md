# TrustSignal Security Posture Snapshot

Generated: 2026-03-13T00:32:09.914Z

> This report summarizes repository-visible security governance indicators. It is a posture snapshot, not proof that all related GitHub or infrastructure settings are enabled in production.

## Checks

| Check | Status | Details |
| --- | --- | --- |
| GitHub workflows present | present | Dependency Review, Trivy, Scorecard, and zizmor workflow files exist. |
| Dependency scanning enabled | present | Dependabot configuration and dependency review workflow are present in-repo. |
| Branch protection indicators | partial | Repository contains documentation or helper automation for branch protection, but actual GitHub rules must be verified manually. |
| CI security tools present | present | Repository-level CI security tooling is present for vulnerabilities, Scorecard, and workflow linting. |

## Interpretation

- `present` means the expected repository file or automation exists.
- `partial` means repository indicators exist, but the control still depends on manual GitHub or infrastructure verification.
- `missing` means the repository does not currently provide the expected indicator.

## Manual Follow-Up

- Verify branch protection or rulesets directly in GitHub.
- Verify Dependency Graph, Dependabot alerts, and code scanning are enabled in repository settings.
- Capture dated screenshots or exports if the result will be used as audit evidence.
