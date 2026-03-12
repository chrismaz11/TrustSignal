# Public Messaging Guardrails

This document is the canonical messaging policy for public-facing TrustSignal content derived from the source-of-truth repo.

## Canonical Positioning

TrustSignal is evidence integrity infrastructure.

Public-facing material should lead with:

- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration
- integrity layer positioning

Public-facing material should not lead with:

- advanced proof architecture
- infrastructure implementation details
- unsupported compliance claims
- roadmap mechanics presented as shipped behavior
- product language that implies TrustSignal replaces the system of record

## Scope

These guardrails apply to public-facing or buyer-facing files in `trustsignal`, including:

- root `README.md`
- canonical messaging or legal docs intended for reuse
- public web surfaces under `apps/web/src/app`
- partner evaluation kit materials under `docs/partner-eval/`

## Review Rules

- If a term appears only as a negative rule, caution, or qualification, it may stay.
- If a term appears as product positioning or as a lead claim, remove or rewrite it.
- If a statement depends on optional or environment-gated behavior, qualify it.
- If a claim cannot be tied back to implementation truth, remove it from public-facing material.

## Check Command

Run the messaging check before merging messaging-heavy changes:

```bash
npm run messaging:check
```
