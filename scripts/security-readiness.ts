import fs from "node:fs";
import path from "node:path";

type CheckResult = {
  status: "present" | "partial" | "missing";
  details: string;
};

const repoRoot = path.resolve(__dirname, "..");

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function evaluate(): Record<string, CheckResult> {
  const workflowsPresent =
    exists(".github/workflows/dependency-review.yml") &&
    exists(".github/workflows/trivy.yml") &&
    exists(".github/workflows/scorecard.yml") &&
    exists(".github/workflows/zizmor.yml");

  const dependencyScanning =
    exists(".github/dependabot.yml") && exists(".github/workflows/dependency-review.yml");

  const branchProtectionIndicators =
    exists("docs/github-settings-checklist.md") &&
    (exists("scripts/apply-github-branch-protection.sh") || exists(".github/pull_request_template.md"));

  const ciSecurityTools =
    exists(".github/workflows/trivy.yml") &&
    exists(".github/workflows/zizmor.yml") &&
    exists(".github/workflows/scorecard.yml");

  return {
    "GitHub workflows present": {
      status: workflowsPresent ? "present" : "missing",
      details: workflowsPresent
        ? "Dependency Review, Trivy, Scorecard, and zizmor workflow files exist."
        : "One or more expected workflow files are missing.",
    },
    "Dependency scanning enabled": {
      status: dependencyScanning ? "present" : "partial",
      details: dependencyScanning
        ? "Dependabot configuration and dependency review workflow are present in-repo."
        : "Repository automation is incomplete or depends on manual GitHub feature enablement.",
    },
    "Branch protection indicators": {
      status: branchProtectionIndicators ? "partial" : "missing",
      details: branchProtectionIndicators
        ? "Repository contains documentation or helper automation for branch protection, but actual GitHub rules must be verified manually."
        : "No branch protection guidance or helper indicators were found.",
    },
    "CI security tools present": {
      status: ciSecurityTools ? "present" : "partial",
      details: ciSecurityTools
        ? "Repository-level CI security tooling is present for vulnerabilities, Scorecard, and workflow linting."
        : "Only part of the expected CI security tooling is present.",
    },
  };
}

function renderMarkdown(results: Record<string, CheckResult>): string {
  const rows = Object.entries(results)
    .map(([name, result]) => `| ${name} | ${result.status} | ${result.details} |`)
    .join("\n");

  return `# TrustSignal Security Posture Snapshot

Generated: ${new Date().toISOString()}

> This report summarizes repository-visible security governance indicators. It is a posture snapshot, not proof that all related GitHub or infrastructure settings are enabled in production.

## Checks

| Check | Status | Details |
| --- | --- | --- |
${rows}

## Interpretation

- \`present\` means the expected repository file or automation exists.
- \`partial\` means repository indicators exist, but the control still depends on manual GitHub or infrastructure verification.
- \`missing\` means the repository does not currently provide the expected indicator.

## Manual Follow-Up

- Verify branch protection or rulesets directly in GitHub.
- Verify Dependency Graph, Dependabot alerts, and code scanning are enabled in repository settings.
- Capture dated screenshots or exports if the result will be used as audit evidence.
`;
}

function main(): void {
  const results = evaluate();
  const outputPath = path.join(repoRoot, "docs/compliance/security-posture.md");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderMarkdown(results));
  console.log(JSON.stringify(results, null, 2));
}

main();
