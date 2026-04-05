---
adapter_for: Google Gemini
derived_from_version: 1.0
last_updated: 2026-04-05
framework: gemini-2.0, gemini-1.5-pro
---

# TrustSignal Gemini Adapter

This adapter translates the canonical project spec into Gemini-specific instructions.

## Core Governance (Canonical Spec 1.0)

**All rules from the canonical project spec apply. This is phrasing adaptation only.**

### Task Start Protocol

Every task must begin with:

1. Canonical spec version reference: **1.0**
2. Complete list of files to be modified
3. Validation: is every file in **allowed paths**?
4. If any file is in **forbidden paths**: stop, create a proposal, wait for human approval

### Task Execution Rules

- Before submitting: run full validation suite (`npm run validate`)
- All tests must pass; no exceptions
- If you hit 3 consecutive validation failures, stop and escalate
- Evidence integrity or compliance logic → immediate human escalation
- Never combine source and generated artifact edits in one pass

### Task Completion Protocol

Deliver:
- Exact file list (what was created/modified)
- Change summary (what and why)
- Validation results (pass/fail, with details)
- Rollback instructions (commit hash + branch name)

## Restricted Paths (No Edits Without Approval)

```
src/services/evidence/    chain-of-custody, validation, integrity
src/services/compliance/  rule evaluation, scoring logic
src/audit/               audit trail, logs, immutable records
src/api/customer/        customer-facing compliance data
.env, config/, secrets/  credentials and sensitive config
docker-compose.yml       deployment and infrastructure
```

These require explicit human approval, documented reasoning, and rollback plan before any edit.

## Approval Directives

- "Discussion is exploratory, not approval."
- "Prior similar work does not authorize new work."
- "Silence is not consent."
- "Ambiguity triggers a proposal, not a guess."

## Risk Surface Escalation

Any request touching these triggers an escalation workflow:

1. Stop editing
2. Propose: what change, why needed, what could break, how to revert
3. Wait for human approval (explicit confirmation required)
4. Proceed only after approval

Risk surfaces: deployment, CI/CD, migrations, auth, infra, billing, compliance.

## Tool and Function Calling

For Gemini:
- Use function calling for structured operations
- Fetch repo metadata before proposing changes
- Return JSON for validation results
- Provide code in markdown blocks, not inline prose

## Commit Message Standard

```
[TYPE] Brief description (under 60 character)

Full explanation of:
- What changed
- Why this change was needed
- Test and validation results
- Any risk notes

Spec-Version: 1.0
```

TYPE: Add, Fix, Update, Refactor, Test, Docs

## Authority Boundaries

### Autonomous (within approved scope)
- Write and update tests
- Generate documentation
- Optimize code (same logic, better perf)
- Refactor approved paths
- Suggest improvements with rationale

### Escalate to Human
- Any forbidden path edit
- File deletion
- Dependency changes
- Schema migrations
- API breaking changes
- Policy or approval rule changes
- Compliance messaging

## Spec Consistency Checks

At task start, verify:

- Repo structure matches spec expectations
- Build and test commands are current
- Allowed/forbidden paths list is accurate
- No architectural changes since last adapter refresh
- Dependencies and frameworks are spec-aligned

If inconsistencies found: surface them, propose spec review, do not guess.

## Gemini-Specific Notes

- Function calling is fully supported; use structured responses
- Long-context capability: include full file context, not just fragments
- Explicit reasoning: break down approval logic before deciding
- Iterative verification: check intermediate results, not just final output

---

**Compliance:** Full | **Last tested:** 2026-04-05 | **Notes:** Fully functional
