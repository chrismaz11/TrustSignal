---
project_state_version: 1.0
last_reviewed: 2026-04-05
review_owner: Christopher Marziani
purpose: "Canonical specification for TrustSignal AI development and governance"
---

# TrustSignal Project AI Control Layer

**Source of truth for all AI-assisted development in the TrustSignal repository.**

## Project Purpose

TrustSignal is a compliance and risk intelligence platform focused on evidence integrity and trust validation. The platform provides compliance officers, legal teams, and enterprise customers with:

- Evidence chain-of-custody tracking and validation
- Compliance posture assessment and reporting
- Risk scoring and remediation guidance
- Audit-ready documentation and audit trails

AI-assisted development in this repo must maintain:
- Accuracy and audit compliance
- Evidence integrity (no model hallucination in compliance-critical paths)
- Clear separation between AI guidance and human-verified decisions
- Compliance messaging that is legally defensible
- No unauthorized changes to policy, approval rules, or high-risk surfaces

## Architecture and Boundaries

### Core services
- Evidence integrity service (chain-of-custody, validation, tamper detection)
- Compliance assessment engine (rule evaluation, scoring, reporting)
- Customer API and dashboard
- Admin console and audit trail

### Critical boundaries
- Evidence validation code (human-verified only, no model edits)
- Compliance rules engine (human approval required for rule changes)
- Audit trail and immutable logs
- Customer-facing compliance reporting

### Model integration points (AI-safe)
- Documentation and guidance (compliance officer talk tracks, how-to guides)
- Test generation and coverage analysis
- Performance benchmarking and optimization
- Development tooling and CI/CD automation
- Internal product design and roadmap discussion

## Allowed Paths

AI-assisted development is allowed in:

```
docs/
src/tests/
src/performance/
src/tools/
.github/workflows/ (except deployment/security-critical steps)
.ai/
README.md
CONTRIBUTING.md
```

## Forbidden Paths

Explicit human approval required before edits to:

```
src/services/evidence/ (evidence chain, validation, integrity checks)
src/services/compliance/ (rule evaluation, scoring logic)
src/audit/ (audit trail, immutable logs, compliance records)
src/api/customer/ (customer-facing compliance data)
docs/compliance-officer/ (compliance messaging - human verified)
.env, .env.example
secrets/, config/ (any credential-like paths)
docker-compose.yml, Dockerfile (deployment surface)
```

## Build, Test, and Validation Commands

Core validation:
```bash
npm test                    # full test suite
npm run lint              # code quality checks
npm run type-check        # TypeScript validation
npm run audit             # npm security audit
npm run compliance:check  # compliance rules validation
npm run evidence:verify   # evidence integrity checks
```

PR validation:
```bash
npm run ci                # all of the above plus coverage
```

## Decision Rights and Approval Policy

### Human approval required before execution agent proceeds
- Any edit to forbidden paths listed above
- Add, remove, or upgrade dependencies
- Schema changes or database migrations
- New API endpoints or breaking API changes
- Compliance messaging or customer-facing copy
- Audit trail modifications
- CI/CD or deployment workflow changes
- Override of any stop rules or token budgets

### Primary AI approval required
- Edits outside the declared task scope
- Refactors larger than the requested scope
- Changes to test intent or coverage strategy
- Edits to source and generated artifacts in the same pass
- Any high-blast-radius config changes

### Execution agent allowed without additional approval
- Targeted edits inside approved file set
- Running validation commands
- Documentation updates explicitly in scope
- Generated artifacts (coverage reports, test output)

## Destructive Action Policy

- **No deletions without explicit human approval.** If removal is needed, create a deletion proposal with:
  - Clear rationale for removal
  - List of dependent code or references
  - Rollback checkpoint (commit hash or branch)
- **No schema changes or migrations without approval.** Evidence integrity depends on precise schema versioning.
- **No dependency downgrades or removals** without security or compliance justification.
- **No silent refactors.** If refactoring is needed, propose it separately with clear scope boundaries.

## Dependency and Migration Policy

### Dependency changes
- New dependencies: human approval required
- Patch upgrades: allowed if CI passes
- Minor upgrades: allowed if CI passes and no API changes
- Major upgrades: human approval required
- Security patches: fast-track if CI passes

### Schema migrations
- All schema changes require human approval
- Evidence-integrity-related migrations require compliance review
- Migrations must include rollback procedure
- Database changes must not interrupt audit trail

## Documentation Update Policy

- **Allowed without approval:** README, contributing guides, internal tooling docs, API reference docs
- **Requires human approval:** Compliance officer talk tracks, customer-facing messaging, audit procedures, security policies
- **Cannot be auto-generated:** Customer-facing compliance guidance (must be legally reviewed)

## Context Drift Controls

### Version discipline
- Canonical spec version: **1.0**
- All adapters must cite this version: `derived_from_version: 1.0`
- Adapter refresh triggers:
  - Canonical spec version incremented
  - Core service architecture changed
  - Allowed/forbidden paths changed
  - Build or validation commands changed
  - Approval rules or decision rights changed
  - New dependencies or major version changes
  - Compliance or audit requirements change

### Current source-of-truth files
- `.ai/skills/project-spec.md` (this file)
- `src/services/` (architecture)
- `docs/ARCHITECTURE.md` (service design)
- `package.json` (dependencies and build commands)
- `.env.example` (configuration surface)
- `src/tests/` (test strategy and coverage)

### Known stale if changed
If any of these files change, adapters should be refreshed:
- `package.json`
- `tsconfig.json`
- `.github/workflows/ci.yml`
- `src/services/*/` (any core service changes)
- `docs/ARCHITECTURE.md`

### Drift checklist
Before starting work, verify:

1. Is this canonical spec version the current one?
2. Have core services or architecture changed since last adapter refresh?
3. Have allowed/forbidden paths changed?
4. Have build or test commands changed?
5. Have approval rules or decision rights changed?
6. Are there pending dependency updates?
7. Has the compliance landscape changed?

If "yes" to any, request a spec review before proceeding.

## Token and Scope Controls

### Before starting work
- Restate current task scope and canonical spec version
- List all files that will be touched
- Confirm that touched files are in allowed paths
- Check whether any high-risk surfaces are involved

### During execution
- Stop after 3 failed validations; propose human review
- Stop if tests fail; do not override with --force
- Stop if evidence-integrity or compliance logic is affected; escalate
- Surface uncertainty instead of guessing

### After completion
- Summarize files touched, changes made, tests passing
- Note any deviations from requested scope
- Provide rollback checkpoint (commit hash)

## Output and Commit Conventions

### Commit messages
Include:
- Imperative mood: "Add", "Fix", "Update" (not "Added", "Fixed")
- Single-line summary (< 60 chars)
- Body: what changed and why
- Footer: `Spec-Version: 1.0` if this repo spec was checked

Example:
```
Add evidence integrity test for tamper detection

Test coverage for the chain-of-custody validation logic.
Verifies that out-of-order events are caught and flagged.
Spec version checked at start of work.

Spec-Version: 1.0
```

### Files touched summary
Before merging, summarize:
- List of files modified
- Summary of changes by category (tests, docs, code)
- Any validation failures or warnings
- Rollback procedure

---

**Last sync:** not yet synced to adapters  
**Next review:** 2026-05-05
