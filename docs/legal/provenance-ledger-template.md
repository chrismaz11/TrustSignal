# TrustSignal Provenance Ledger Template

Use this template to document the first registration bundle and any later filing candidates.

## Instructions

- Create one row per work or file group.
- Use exact repository paths.
- Mark any AI-assisted, template-derived, contractor-created, or third-party-influenced work explicitly.
- Exclude generated artifacts, vendor dependencies, sample documents, secrets, and output folders unless legal review says otherwise.

## Recommended First Bundle

The cleanest first registration bundle is the core signed-receipt and verification source set:

- `packages/core/src/receipt.ts`
- `packages/core/src/receiptSigner.ts`
- `packages/core/src/verification.ts`
- `packages/core/src/types.ts`
- `packages/core/src/registry.ts`

## Ledger Columns

| work_id | title | path | category | included_in_initial_bundle | claimed_owner | primary_author | author_role | assignment_confirmed | first_created_date | last_material_edit_date | ai_assistance_used | ai_tools_used | human_review_confirmed | third_party_source_used | source_notes | template_or_vendor_dependency | generated_artifact | exclusion_reason | license_status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TS-REG-001 | Receipt payload builder | `packages/core/src/receipt.ts` | source_code | yes | TrustSignal |  |  |  |  |  |  |  |  |  |  |  | no |  | proprietary-intended |  |
| TS-REG-002 | Receipt signature module | `packages/core/src/receiptSigner.ts` | source_code | yes | TrustSignal |  |  |  |  |  |  |  |  |  |  |  | no |  | proprietary-intended |  |
| TS-REG-003 | Verification engine | `packages/core/src/verification.ts` | source_code | yes | TrustSignal |  |  |  |  |  |  |  |  |  |  |  | no |  | proprietary-intended |  |
| TS-REG-004 | Shared receipt and verification types | `packages/core/src/types.ts` | source_code | yes | TrustSignal |  |  |  |  |  |  |  |  |  |  |  | no |  | proprietary-intended |  |
| TS-REG-005 | Registry signing and verification | `packages/core/src/registry.ts` | source_code | yes | TrustSignal |  |  |  |  |  |  |  |  |  |  |  | no |  | proprietary-intended |  |

## Excluded-by-Default Categories

- `dist/`
- `.next/`
- `artifacts/`
- `cache/`
- `target/`
- `node_modules/`
- `.venv/`
- `.vercel/`
- `output/`
- sample PDFs and watched-folder fixtures
- private keys, secrets, and environment files

## License-Decision Hold

Do not include the following in the initial proprietary bundle until licensing intent is resolved:

- `packages/contracts/contracts/AnchorRegistry.sol`

## Filled Draft For Initial Bundle

This draft is based only on repository-visible evidence: git history, commit metadata, current file paths, and repository AI workflow/policy files. Anything not directly supported by repo evidence is marked as needing external confirmation.

| work_id | title | path | category | included_in_initial_bundle | claimed_owner | primary_author | author_role | assignment_confirmed | first_created_date | last_material_edit_date | ai_assistance_used | ai_tools_used | human_review_confirmed | third_party_source_used | source_notes | template_or_vendor_dependency | generated_artifact | exclusion_reason | license_status | notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TS-REG-001 | Receipt payload builder | `packages/core/src/receipt.ts` | source_code | yes | Founder-created work associated with TrustSignal | chrismaz11 | Founder of TrustSignal | Founder-created; final claimant/entity-chain wording requires external confirmation if formal registration is filed in a company name | 2026-01-12 | 2026-03-08 | yes | Codex, Gemini, and/or Perplexity may have been used during later drafting or revision; exact file-level tool attribution not fully reconstructed from repo evidence | yes | no, based on founder statement | Created in `Initial repo push`; later edits in `feat(v2): Implement Risk Engine, ZKP, Revocation, Portability and Documentation`, `feat: implement passive inspector and organization schema`, `feat: security hardening, compliance updates, and config refactor`, and `Create stable ALLOW demo fixture` | none visible in repo evidence | no |  | proprietary-intended | Founder states AI-assisted files were personally reviewed and final versions were personally chosen |
| TS-REG-002 | Receipt signature module | `packages/core/src/receiptSigner.ts` | source_code | yes | Founder-created work associated with TrustSignal | chrismaz11 | Founder of TrustSignal | Founder-created; final claimant/entity-chain wording requires external confirmation if formal registration is filed in a company name | 2026-03-08 | 2026-03-08 | yes | Codex, Gemini, and/or Perplexity may have been used; exact per-commit tool attribution not fully reconstructed from repo evidence | yes | no, based on founder statement | File created in `Create stable ALLOW demo fixture`; materially updated in `fix(security): remove embedded dev signer and harden receipt verification` | none visible in repo evidence | no |  | proprietary-intended | Highest AI-assistance likelihood in the bundle, but founder confirms personal review and final selection of the file contents |
| TS-REG-003 | Verification engine | `packages/core/src/verification.ts` | source_code | yes | Founder-created work associated with TrustSignal | chrismaz11 | Founder of TrustSignal | Founder-created; final claimant/entity-chain wording requires external confirmation if formal registration is filed in a company name | 2026-01-12 | 2026-01-16 | unknown | no specific AI tool usage evidenced in repo for this file | yes | no, based on founder statement | Created in `Initial repo push`; last visible update in `feat: content update including documentation stack and verification logic` | none visible in repo evidence | no |  | proprietary-intended | Cleanest file in the bundle from visible git history; no repo evidence of third-party source use |
| TS-REG-004 | Shared receipt and verification types | `packages/core/src/types.ts` | source_code | yes | Founder-created work associated with TrustSignal | chrismaz11 | Founder of TrustSignal | Founder-created; final claimant/entity-chain wording requires external confirmation if formal registration is filed in a company name | 2026-01-12 | 2026-03-08 | yes | Codex, Gemini, and/or Perplexity may have been used during later revision; exact file-level attribution not fully reconstructed from repo evidence | yes | no, based on founder statement | Created in `Initial repo push`; later updated in `feat(v2): Implement Risk Engine, ZKP, Revocation, Portability and Documentation` and `Create stable ALLOW demo fixture` | none visible in repo evidence | no |  | proprietary-intended | Founder confirms personal review and final selection for AI-assisted changes |
| TS-REG-005 | Registry signing and verification | `packages/core/src/registry.ts` | source_code | yes | Founder-created work associated with TrustSignal | chrismaz11 | Founder of TrustSignal | Founder-created; final claimant/entity-chain wording requires external confirmation if formal registration is filed in a company name | 2026-01-12 | 2026-01-12 | unknown | no specific AI tool usage evidenced in repo for this file | yes | no, based on founder statement | Created and last modified in `Initial repo push` | none visible in repo evidence | no |  | proprietary-intended | Strongest clean candidate in the set by git history and lowest visible AI/provenance risk |
