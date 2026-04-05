---
adapter_for: Claude
derived_from_version: 1.0
last_updated: 2026-04-05
framework: claude-3.5-sonnet / claude-opus
---

# TrustSignal Claude AI Adapter

This adapter translates the canonical project spec into Claude-specific instructions and tool phrasing.

## Core Behavioral Rules

**All rules from canonical spec apply.** This adapter is thin phrasing only.

### Before you start any task
1. State the canonical spec version you are working from: **1.0**
2. List all files you will touch
3. Confirm all touched files are in the **allowed paths** list
4. If any touched files are in **forbidden paths**, stop and ask for human approval

### During task execution
- Stop after 3 failed validations; propose human review instead of retrying
- Stop immediately if evidence-integrity or compliance logic is involved; escalate
- Run `npm run ci` before suggesting changes (all checks must pass)
- Do not override test failures with `--force` or skip validation
- Do not mix source and generated artifact edits in one pass
- Surface uncertainty instead of guessing

### After you complete the task
- Summarize: files touched, what changed, validation results
- Note any deviations from what was requested
- Provide rollback checkpoint (exact commit hash or branch name)

## Approval Language

Use direct, unambiguous approval language:

- "Discussion is not approval."
- "Absence of objection is not approval."
- "I cannot infer authorization from prior similar work."
- "When scope is ambiguous, I stop and propose a bounded plan."

## High-Risk Surface Handling

When you see any change touching these areas, **stop immediately**:

- `src/services/evidence/` (chain-of-custody, validation, integrity checks)
- `src/services/compliance/` (rule evaluation, scoring)
- `src/audit/` (audit trail, immutable logs)
- `src/api/customer/` (customer-facing compliance data)
- Deployment, CI, secrets, auth, billing surfaces

For all of these: create a proposal with rationale, dependent code analysis, and rollback plan. Then wait for explicit human approval before proceeding.

## Tool Invocation Rules

### When writing code
- Use `Write` tool to create new files (not inline code blocks)
- Use `Edit` tool to modify existing files (surgical edits, not rewrites)
- Include line numbers and context when editing
- Provide complete, runnable examples

### When running validation
- Use `Bash` tool to run commands from the canonical spec
- Always run `npm run ci` before suggesting changes
- Parse test output for failures, don't assume pass from silence
- Report exit codes and stderr, not just stdout

### When proposing changes
- Use `TodoWrite` to track multi-step tasks
- Break complex work into bounded execution steps
- Create a plan before starting high-risk changes
- Provide diffs or before/after comparisons

## Decision Authority Boundaries

### I decide
- How to phrase explanations and guidance
- Which validation commands to run
- Whether to ask for human input or proceed with bounded tasks
- How to format output and documentation

### I escalate (ask for human approval)
- Any edit to forbidden paths
- Adding, removing, or upgrading dependencies
- Schema changes or database migrations
- Breaking API changes
- Compliance messaging
- Override of stop rules or token budgets

### I never do
- Edit forbidden paths without explicit approval
- Delete files without approval
- Change approval rules or governance policy
- Ignore test failures or validation errors
- Reinterpret approvals from prior conversations
- Make "helpful" changes outside the requested scope

## Commit Message Format

Follow this pattern:

```
Imperative summary (<60 chars)

Body: explain what changed and why.
Include any validation results or caveats.

Spec-Version: 1.0
```

Example:
```
Add evidence integrity test for tamper detection

Test coverage for chain-of-custody validation.
Verifies that out-of-order events are caught.
All existing tests pass.

Spec-Version: 1.0
```

## Context Drift Handling

At the start of each task, restate:

1. **Canonical spec version:** 1.0
2. **Files to touch:** [list all files]
3. **Forbidden paths check:** [list any forbidden path concerns]
4. **Approval status:** [what approvals are needed before I start]

If the repo looks inconsistent with spec 1.0, surface that instead of guessing.

## Adapter Status

- **Compliance:** Full
- **Last tested:** 2026-04-05
- **Known limitations:** None
