import fs from "node:fs";
import path from "node:path";

type RepoDefinition = {
  name: string;
  readmePath: string;
};

type ClaimRule = {
  name: string;
  expectedRepo: string;
  patterns: RegExp[];
};

const familyRoot = path.resolve(
  process.env.TRUSTSIGNAL_REPO_FAMILY_ROOT ?? path.join(__dirname, "..", "..")
);

const repoDefinitions: RepoDefinition[] = [
  { name: "TrustSignal", readmePath: "TrustSignal/README.md" },
  { name: "v0-signal-new", readmePath: "v0-signal-new/README.md" },
  { name: "TrustSignal-App", readmePath: "TrustSignal-App/README.md" },
  { name: "TrustSignal-docs", readmePath: "TrustSignal-docs/README.md" },
  { name: "trustagents", readmePath: "trustagents/README.md" },
  { name: "TrustSignal-Verify-Artifact", readmePath: "TrustSignal-Verify-Artifact/README.md" },
];

const requiredStatusLabel = /^> Status:/m;
const requiredSourceOfTruthSection = /^## Source of Truth$/m;
const productionReadyAllowMarker = "repo-consistency: allow production-ready";

const forbiddenRules: Array<{ label: string; pattern: RegExp }> = [
  { label: 'forbidden phrase "production-ready"', pattern: /\bproduction-ready\b/i },
  {
    label: "unsupported TrustSignal action major-tag example",
    pattern: /uses:\s*TrustSignal-dev\/[^\s`]+@v\d+\b/i,
  },
  {
    label: 'unsupported "use @v1" instruction',
    pattern: /\buse\s+@v\d+\b/i,
  },
  {
    label: "hardcoded version claim without evidence",
    pattern: /\b(?:current|latest|stable)\s+(?:version|release|tag)\s+(?:is|=)\s*v?\d+(?:\.\d+){0,2}\b/i,
  },
  { label: "placeholder ref pattern", pattern: /@<[^>\n]+>/ },
  { label: "TODO placeholder in README", pattern: /\bTODO\b/ },
];

const claimRules: ClaimRule[] = [
  {
    name: "primary docs",
    expectedRepo: "v0-signal-new",
    patterns: [
      /\bis the (?:primary|canonical) (?:live )?(?:public )?docs(?: source| hub| surface)?\b/i,
      /This repo is the primary public website,\s*docs,\s*and onboarding surface/i,
      /This repo is the primary live public docs source/i,
    ],
  },
  {
    name: "main frontend",
    expectedRepo: "v0-signal-new",
    patterns: [
      /\bis the (?:main|primary|canonical) public frontend\b/i,
      /This repo is the primary public website,\s*docs,\s*and onboarding surface/i,
      /This repo is the canonical public frontend/i,
    ],
  },
  {
    name: "canonical API",
    expectedRepo: "TrustSignal",
    patterns: [
      /\bis the canonical (?:backend\/API|API)\b/i,
      /Canonical backend\/API source:\s*`TrustSignal\/apps\/api`/i,
      /This repo is the canonical API/i,
    ],
  },
];

const isAllowedViolation = (ruleLabel: string, content: string): boolean => {
  if (
    ruleLabel === 'forbidden phrase "production-ready"' &&
    content.includes(productionReadyAllowMarker)
  ) {
    return true;
  }

  return false;
};

const walkReadmes = (dirPath: string): string[] => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === "dist" ||
      entry.name === "build" ||
      entry.name === "coverage" ||
      entry.name === "output" ||
      entry.name === "tmp"
    ) {
      continue;
    }

    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkReadmes(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name === "README.md") {
      results.push(fullPath);
    }
  }

  return results;
};

const missingRepos = repoDefinitions.filter(({ readmePath }) => {
  return !fs.existsSync(path.join(familyRoot, readmePath));
});

if (missingRepos.length > 0) {
  console.error("Repo consistency check could not find the expected repo READMEs:");
  for (const repo of missingRepos) {
    console.error(`- ${repo.readmePath}`);
  }
  process.exit(1);
}

const violations: string[] = [];
const allReadmes = walkReadmes(familyRoot);
const rootReadmes = repoDefinitions.map((repo) => ({
  ...repo,
  absolutePath: path.join(familyRoot, repo.readmePath),
}));

for (const repo of rootReadmes) {
  const content = fs.readFileSync(repo.absolutePath, "utf8");

  if (!requiredStatusLabel.test(content)) {
    violations.push(`${repo.readmePath}: missing top-level status label`);
  }

  if (!requiredSourceOfTruthSection.test(content)) {
    violations.push(`${repo.readmePath}: missing "## Source of Truth" section`);
  }
}

for (const readmePath of allReadmes) {
  const relativePath = path.relative(familyRoot, readmePath);
  const content = fs.readFileSync(readmePath, "utf8");

  for (const rule of forbiddenRules) {
    if (rule.pattern.test(content) && !isAllowedViolation(rule.label, content)) {
      violations.push(`${relativePath}: ${rule.label}`);
    }
  }
}

for (const rule of claimRules) {
  const matchedRepos = rootReadmes
    .filter((repo) => {
      const content = fs.readFileSync(repo.absolutePath, "utf8");
      return rule.patterns.some((pattern) => pattern.test(content));
    })
    .map((repo) => repo.name);

  const uniqueMatches = [...new Set(matchedRepos)];

  if (uniqueMatches.length > 1) {
    violations.push(
      `role drift: multiple repos claim ${rule.name} (${uniqueMatches.join(", ")})`
    );
    continue;
  }

  if (uniqueMatches.length === 1 && uniqueMatches[0] !== rule.expectedRepo) {
    violations.push(
      `role drift: ${rule.name} claimed by ${uniqueMatches[0]} but expected ${rule.expectedRepo}`
    );
  }
}

if (violations.length > 0) {
  console.error("Repo consistency check failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log(`Repo consistency check passed for ${allReadmes.length} README files.`);
