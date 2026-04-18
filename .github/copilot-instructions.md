# Copilot Instructions for TrustSignal

TrustSignal is a compliance and evidence-integrity platform. Optimize for correctness, narrow scope, and auditability over speed.

## First commands
- `npm ci`
- `npm run typecheck`
- `npm test`
- `npm run security:audit`

## Preferred validation
- Use `npm run validate` before proposing completion.
- If touching only `apps/web`, also run `npm --workspace apps/web run build`.
- If touching only `apps/api`, run `npm --workspace apps/api run typecheck` and the relevant tests.

## High-risk areas
Treat these as human-review surfaces. Do not change them unless the task explicitly requires it and call out the risk in your summary.
- `src/services/evidence/`
- `src/services/compliance/`
- `src/audit/`
- `src/api/customer/`
- `docs/compliance-officer/`
- `.env`, `.env.example`, secret-bearing config, deployment files

## Safe default scope
These are the lowest-risk places for AI-assisted work.
- `docs/`
- `src/tests/`
- `src/performance/`
- `src/tools/`
- `.github/workflows/`
- `.ai/`
- `README.md`
- `CONTRIBUTING.md`

## Workflow guidance
- Keep changes tightly scoped.
- Do not add dependencies without explaining why.
- Do not remove files or make destructive changes without explicit approval.
- Prefer pinned GitHub Actions revisions in workflow files.
- When a security alert appears workflow-related, fix the workflow itself before dismissing the alert.

## AI control layer
The canonical project AI policy lives here:
- `.ai/skills/project-spec.md`
- `.agents/primary-agent.md`
- `.agents/executor-agent.md`

When these files conflict with ad hoc assumptions, follow the repo policy files.
