# TrustSignal AI Skill Sync Change Log

Append-only record of meaningful changes to project spec, adapters, or governance that trigger or should trigger re-sync.

## 2026-04-05 - Initial canonical spec

**Version: 1.0**

- Created canonical project-spec.md with TrustSignal-specific governance
- Defined allowed and forbidden paths (evidence services, audit trail, compliance rules as forbidden)
- Established decision rights: human approval for high-risk surfaces, primary AI for scope oversight, execution agents for bounded tasks
- Set up context drift controls with version discipline and refresh triggers
- Defined build/test/validation commands
- Established approval matrix and destructive action policy
- Created model-specific adapters for OpenAI, Claude, Gemini
- Generated primary-agent.md and executor-agent.md policies
- Set up GitHub Action workflow for manual trigger sync validation
