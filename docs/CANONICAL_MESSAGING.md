# TrustSignal Canonical Messaging

This document is the messaging source of truth for TrustSignal across the three-repo system.

- `trustsignal` defines implementation truth.
- `TrustSignal-docs` is the public documentation layer derived from implementation truth.
- `v0-signal-new` is the public website and presentation layer derived from approved messaging and public-safe docs.

Public messaging may simplify. It may not contradict the codebase, overstate experimental work, or present roadmap items as shipped behavior.

## Canonical Narrative

TrustSignal is evidence integrity infrastructure for existing workflows. It acts as an integrity layer that returns signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability. TrustSignal is designed to strengthen existing systems of record and partner workflows by adding durable verification artifacts rather than replacing those systems. Deed verification, compliance evidence, and future credentialing flows are examples of where the integrity layer fits.

## Messaging Hierarchy

### Lead Story

- Evidence integrity infrastructure for existing workflows
- Signed verification receipts at the point of evaluation
- Verification signals and audit-ready evidence
- Verifiable provenance and later verification

### Supporting Proof Points

- TrustSignal sits behind an existing workflow instead of replacing it
- Auditors and operators need durable verification artifacts, not just workflow notes
- The product fits evidence collection, deeds, compliance records, and credential workflows
- Public messaging should show the integrity model before deeper architecture

### Technical Depth Layer

- Signed verification receipts, digest comparison, receipt retrieval, later verification, and revocation controls
- Registry integrations and evidence payloads may be discussed where implementation-backed
- Provenance-state retrieval may appear after the core integrity model is clear

### Roadmap Layer

- More advanced proof systems
- Expanded provenance portability
- Deeper registry and analytics work
- Any future AI-related expansion

## What To Reject

### Entity Confusion

- Do not collapse TrustSignal, TrustSignal, Vanta, healthcare, and future marketplaces into one undifferentiated story
- Do not let the deed wedge define the entire product
- Do not describe TrustSignal as a replacement for the system that collected the evidence

### Unsupported Precision

- Do not use exact performance, fraud-detection, or coverage numbers unless currently verified and reproducible
- Do not use market-loss statistics as the primary proof of product value
- Do not publish exact technical claims that imply more than the implementation supports

### Claims Requiring Repo Verification

- Do not present production readiness as complete without infrastructure evidence
- Do not present experimental or dev-only proof paths as public guarantees
- Do not present roadmap architecture as shipped behavior

## Public Website Structure

1. Hero: evidence integrity infrastructure for existing workflows
2. Problem: why integrity drift and audit gaps matter
3. Integrity model: signed verification receipts and verification signals
4. Integration fit: how TrustSignal sits behind an existing workflow
5. Use cases: deeds, compliance evidence, credentialing, other high-trust records
6. Technical detail: implementation-backed foundations only
7. Security boundary: what the public site does and does not expose
8. Pilot CTA and intake
9. Legal, privacy, and security pages

## README Structure

1. Title and one-sentence positioning
2. Problem
3. Integrity model
4. Integration fit
5. Technical detail
6. Public API contract and examples
7. Security posture
8. What is explicitly not claimed
9. Local development
10. Validation
11. Documentation map

## Claim Rules

### Allowed Now

- TrustSignal is evidence integrity infrastructure
- TrustSignal adds signed verification receipts
- TrustSignal returns verification signals
- TrustSignal provides verifiable provenance and later verification
- TrustSignal fits behind an existing workflow with low integration friction
- TrustSignal strengthens evidence and compliance pipelines instead of replacing them
- Deed verification is one use case

### Allowed Only With Qualification

- Registry verification or screening
- Revocation controls
- Provenance-state retrieval
- SDK or integration ergonomics
- Pilot readiness or enterprise readiness
- Test or performance metrics

### Roadmap Only

- Broad AI fraud detection as the lead product story
- Full production-grade document authenticity guarantees beyond current implementation
- Marketplace-ready claims without evidence-backed controls and validation
- Any claim implying private infrastructure or advanced proof architecture is complete if it is still partial, gated, or experimental
