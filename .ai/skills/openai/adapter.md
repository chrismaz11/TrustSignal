---
adapter_for: OpenAI / GPT
derived_from_version: 1.0
last_updated: 2026-04-05
framework: gpt-4-turbo, gpt-4o
---

# TrustSignal OpenAI Adapter

This adapter translates the canonical project spec into OpenAI-specific instructions.

## Core Rules (from canonical spec 1.0)

**All approval thresholds, allowed/forbidden paths, and governance rules from the canonical spec apply exactly.**

### Start checklist for every task

- State canonical spec version: **1.0**
- List all files you will create or modify
- Verify every touched file is in **allowed paths**
- If any file is in **forbidden paths**, stop and request human approval before proceeding

### During execution

- Run `npm run ci` before submitting changes (all checks must pass)
- Stop if any test fails; do not use `--force` or skip validation
- Stop after 3 validation failures; ask for human guidance
- If evidence-integrity, compliance logic, or audit trail is involved, escalate to human
- Do not mix source code and generated artifact edits in the same task

### After completion

- Provide: list of files touched, summary of changes, validation status
- Note any scope deviations from the request
- Include exact rollback information (commit hash or branch)

## Forbidden Paths (Absolute Prohibition)

Do not edit these without explicit human approval:

```
src/services/evidence/      → chain-of-custody, validation
src/services/compliance/    → rule evaluation, scoring
src/audit/                  → audit trail, immutable logs
src/api/customer/           → customer-facing data
.env, secrets/              → credentials
docker-compose.yml          → deployment
```

## Approval Language

- "Discussion does not equal approval."
- "I do not infer authorization from previous similar work."
- "I do not proceed if scope is ambiguous; I propose a plan instead."

## High-Risk Surfaces

If you request edits to these, I will:

1. Refuse to edit without explicit human approval
2. Create a proposal explaining the change, dependencies, and rollback plan
3. Wait for direct confirmation before proceeding

Surfaces: deployment, CI/CD, secrets, auth, infra, data migrations, API contracts, compliance policies.

## Tool Usage

For this platform:
- Use REST APIs or official SDK for version control operations
- Fetch repo structure before proposing changes
- Use tool_choice to force specific function calls when needed
- Provide structured output (JSON, code blocks) for clarity

## Commit Format

```
[ACTION] brief summary under 60 chars

Detailed explanation of what changed and why.
Include test results and validation status.

Spec-Version: 1.0
```

Actions: Add, Fix, Update, Refactor, Test (not past tense).

## Scope Boundaries

### I can do (with spec approval)
- Write tests and documentation
- Optimize performance and tooling
- Generate coverage reports
- Suggest refactors for approved paths

### I cannot do (escalate to human)
- Delete files
- Modify approval policies
- Change allowed/forbidden paths
- Edit compliance or audit surfaces
- Upgrade major dependencies
- Change API contracts
- Make breaking changes

## Drift Detection

At task start, flag any of these:

- Repo structure differs from spec
- Dependencies have newer major versions
- Build commands have changed
- Test strategy has changed
- Architecture has evolved

If detected: stop and propose a spec review instead of guessing.

## Model-Specific Notes

- GPT-4 and GPT-4o both support function calling; use structured outputs
- Be explicit about approval boundaries (GPT models can overlook implicit restrictions)
- Request step-by-step reasoning for high-risk decisions
- Provide examples of good and bad decisions from this spec

---

**Compliance:** Full | **Last tested:** 2026-04-05
