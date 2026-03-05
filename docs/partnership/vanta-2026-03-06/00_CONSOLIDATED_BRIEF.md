# TrustSignal + Vanta Partnership Brief

Date prepared: 2026-03-05  
Meeting date: 2026-03-06

## 1) Partnership Strategy (Recommended)

Primary proposal (Phase 1, 30-60 days):
- API integration partnership: Vanta calls TrustSignal verification APIs and ingests cryptographic receipts into Vanta evidence workflows.
- Co-selling/referral motion in high-stakes verticals: fintech, healthcare, legal, real estate.

Secondary proposal (Phase 2):
- Marketplace/listing + packaged integration templates.
- White-label option for selected enterprise accounts after pilot KPI validation.

Commercial framing for call:
- Pilot: 1-2 shared customers, fixed integration scope, success criteria tied to speed and auditability.
- Expansion: usage-based pricing + referral/revenue-share option.

## 2) Contact and Discovery Gaps (Must confirm on call)

Current unknowns to resolve in first 10 minutes:
- Vanta counterpart role: Business Development, Product, Engineering, or mixed group.
- Vanta's current document verification path:
  - Manual review?
  - Third-party identity/document provider?
  - No native verification and customer-managed evidence?
- Buyer urgency and target launch window for a partner integration.

Suggested opening question:
- "Today, where does document and credential authenticity checking live in your workflow, and what part is most painful for your customers?"

## 3) Repo Cleanup and Separation Status (as of 2026-03-05)

Status: **NOT CLEAN** (worktree has pending tracked and untracked changes)

Tracked modified:
- `apps/watcher/src/index.js`
- `apps/web/package.json`
- `apps/web/src/components/FileDropzone.tsx`
- `package.json`
- `package-lock.json`
- `packages/contracts/package.json`
- `packages/core/tsconfig.tsbuildinfo`
- Submodule pointer changed: `Deed_Shield`

Untracked artifacts:
- `.DS_Store`, `docs/.DS_Store`
- `fossa.debug.zip`
- `output/jupyter-notebook/`
- `output/security-ownership-map/`
- `vercel.api.json`
- `apps/api/.gitignore`

Leak/separation checks:
- No obvious marketing-site keyword leakage found in `apps/api/src`.
- Submodule remains isolated (`Deed_Shield` tracked as submodule), but pointer/worktree state is dirty and should be normalized before external handoff.

## 4) Integration Story in One Sentence

"Vanta stays the system of record for compliance workflows while TrustSignal provides cryptographic verification receipts and ZK-backed authenticity signals through API-first integration."

## 5) Deliverables Produced

- Integration architecture and data flow: `02_INTEGRATION_ARCHITECTURE.md`
- Partnership API OpenAPI spec: `03_VANTA_PARTNER_API_OPENAPI.yaml`
- Webhook contract: `04_WEBHOOK_CONTRACT.md`
- Demo scenarios + script: `05_DEMO_SCENARIOS_AND_SCRIPT.md`
- Infrastructure/SLA/security package: `06_INFRA_SLA_SECURITY_PACKAGE.md`
- Pitch narrative + one-pager: `07_PITCH_NARRATIVE_AND_ONE_PAGER.md`
- FAQ and objection handling: `08_PARTNERSHIP_FAQ.md`
- Postman collection: `postman/TrustSignal_Vanta_Partner_Demo.postman_collection.json`
- Interactive mock dashboard: `apps/api/public/demo/vanta-partner-demo.html`

## 6) Meeting Ask and Next Step

Primary ask for tomorrow:
- Agreement to a joint technical evaluation (30 days) with one concrete pilot workflow.

Backup ask:
- Product + engineering working session to finalize API schema, auth mode, and webhook events.

Success metric for next checkpoint:
- First Vanta-side evidence ingest using TrustSignal receipt payload in under 2 seconds end-to-end for demo dataset.
