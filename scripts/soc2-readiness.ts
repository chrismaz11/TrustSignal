import fs from "node:fs";
import path from "node:path";

type CategoryName =
  | "Access Control"
  | "Infrastructure Security"
  | "Secure Development"
  | "Monitoring"
  | "Secrets Management"
  | "Incident Response"
  | "Data Protection"
  | "Compliance Documentation";

type CategoryResult = {
  score: 0 | 1 | 2 | 3;
  rationale: string;
  remediation: string[];
};

const repoRoot = path.resolve(__dirname, "..");

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function categoryResults(): Record<CategoryName, CategoryResult> {
  return {
    "Access Control": {
      score: exists("docs/github-settings-checklist.md") ? 2 : 1,
      rationale:
        "Repository documentation covers branch protection and review expectations, but in-repo evidence does not prove completed access reviews or enforced GitHub settings.",
      remediation: [
        "Capture recurring access review evidence for GitHub and production systems.",
        "Enable and verify branch protection or rulesets with required reviews on main.",
      ],
    },
    "Infrastructure Security": {
      score: exists(".github/workflows/trivy.yml") && exists(".github/workflows/scorecard.yml") ? 2 : 1,
      rationale:
        "Repository-level security workflows exist for dependency review, Trivy, and Scorecard, but infrastructure controls still require manual verification outside the repo.",
      remediation: [
        "Document environment hardening baselines and infrastructure ownership.",
        "Capture operational evidence for backup, recovery, and hosted-service security settings.",
      ],
    },
    "Secure Development": {
      score:
        exists(".github/pull_request_template.md") &&
        exists(".github/workflows/dependency-review.yml") &&
        exists(".github/workflows/zizmor.yml")
          ? 3
          : 1,
      rationale:
        "Pull request review guidance and security-focused CI checks provide strong repository-level secure development coverage for a readiness baseline.",
      remediation: [
        "Add documented secure code review ownership and periodic retrospective review of findings.",
      ],
    },
    Monitoring: {
      score: exists("docs/compliance/security-posture.md") ? 2 : 1,
      rationale:
        "The repository can generate a security posture snapshot and retain CI scan outputs, but ongoing production monitoring evidence is not proven by repository files alone.",
      remediation: [
        "Document log review cadence, alert routing, and monitored systems.",
        "Attach monitoring exports or screenshots for operational environments.",
      ],
    },
    "Secrets Management": {
      score: exists("SECURITY_CHECKLIST.md") || exists("apps/api/.env.example") ? 2 : 1,
      rationale:
        "TrustSignal guidance prohibits hardcoded secrets and uses environment-based configuration, but rotation cadence and vault evidence are not yet captured in this framework.",
      remediation: [
        "Track secret rotation ownership and review cadence.",
        "Collect evidence that production secrets are stored and rotated using approved mechanisms.",
      ],
    },
    "Incident Response": {
      score: exists("docs/compliance/policies/incident-response-policy.md") ? 2 : 0,
      rationale:
        "A formal policy template exists, but exercised incident records, communication drills, and post-incident evidence are not yet included.",
      remediation: [
        "Run a tabletop exercise and retain the output.",
        "Define severity levels, contact paths, and evidence preservation procedures in operating records.",
      ],
    },
    "Data Protection": {
      score:
        exists("docs/compliance/policies/data-retention-policy.md") && exists("docs/security-summary.md") ? 2 : 1,
      rationale:
        "Data handling and retention guidance now exists, but applied retention schedules and production evidence still need to be collected.",
      remediation: [
        "Define retention windows by evidence and operational data category.",
        "Capture proof of encryption, access controls, and disposal procedures where applicable.",
      ],
    },
    "Compliance Documentation": {
      score:
        exists("docs/compliance/soc2/controls.md") &&
        exists("docs/compliance/soc2/readiness-checklist.md") &&
        exists("docs/compliance/soc2/readiness-report.md")
          ? 3
          : 2,
      rationale:
        "The repository contains a structured readiness framework, policy templates, and generated reporting suitable for a mock-audit baseline.",
      remediation: [
        "Assign document owners and refresh cadence for each policy and evidence tracker.",
      ],
    },
  };
}

function buildReport(): { markdown: string; percentage: number; results: Record<CategoryName, CategoryResult> } {
  const results = categoryResults();
  const categoryEntries = Object.entries(results) as Array<[CategoryName, CategoryResult]>;
  const totalScore = categoryEntries.reduce((sum, [, item]) => sum + item.score, 0);
  const maxScore = categoryEntries.length * 3;
  const percentage = Math.round((totalScore / maxScore) * 100);

  const remediationItems = categoryEntries
    .flatMap(([name, item]) =>
      item.score < 3 ? item.remediation.map((entry) => `- ${name}: ${entry}`) : [],
    )
    .join("\n");

  const tableRows = categoryEntries
    .map(
      ([name, item]) =>
        `| ${name} | ${item.score} / 3 | ${item.rationale} |`,
    )
    .join("\n");

  const markdown = `# TrustSignal SOC 2 Readiness Report

Generated: ${new Date().toISOString()}

> This report is an internal readiness snapshot aligned to SOC 2 Security criteria. It is intended for planning and gap remediation. It is not an audit opinion and does not imply SOC 2 certification.

## Overall Readiness Score

${percentage}%

## Category Scores

| Category | Score | Notes |
| --- | --- | --- |
${tableRows}

## Recommended Remediation Items

${remediationItems}

## Scoring Model

- 0 = missing
- 1 = partial
- 2 = implemented
- 3 = strong

## Notes

- Scores are based on repository-visible controls and documentation only.
- GitHub UI configuration, infrastructure operations, access reviews, and restore testing still require manual verification.
- This report should be refreshed when major security workflows, policies, or governance controls change.
`;

  return { markdown, percentage, results };
}

function main(): void {
  const outputPath = path.join(repoRoot, "docs/compliance/soc2/readiness-report.md");
  const { markdown, percentage, results } = buildReport();
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, markdown);

  const summary = {
    generatedAt: new Date().toISOString(),
    scorePercentage: percentage,
    categories: results,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main();
