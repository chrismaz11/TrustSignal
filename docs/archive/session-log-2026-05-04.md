# TrustSignal — Master Conversation Log
**Compiled:** May 4, 2026  
**Founder:** Christopher Marziani  
**Source:** All Claude conversation sessions referencing TrustSignal  
**Scope:** Product, architecture, engineering decisions, ICE meeting prep, GTM, and open issues

---

## TABLE OF CONTENTS

1. [Company Identity & Category](#1-company-identity--category)
2. [Core Product Thesis](#2-core-product-thesis)
3. [Architecture — Sidecar / Middleware Model](#3-architecture--sidecar--middleware-model)
4. [Canonical Tech Stack](#4-canonical-tech-stack)
5. [GitHub Org Map (trustsignal-dev)](#5-github-org-map-trustsignal-dev)
6. [Receipt Format & Anchoring](#6-receipt-format--anchoring)
7. [Technical Debt (P0 Open Issues)](#7-technical-debt-p0-open-issues)
8. [Code Fixes Completed](#8-code-fixes-completed)
9. [Whitepaper Corrections (v2.3 → v2.4)](#9-whitepaper-corrections-v23--v24)
10. [ICE Mortgage Technology — May 15th Meeting Prep](#10-ice-mortgage-technology--may-15th-meeting-prep)
11. [Demo Site](#11-demo-site)
12. [Privacy Policy & Data Handling](#12-privacy-policy--data-handling)
13. [API Reference (Confirmed Endpoints)](#13-api-reference-confirmed-endpoints)
14. [Warp Oz Agent Setup](#14-warp-oz-agent-setup)
15. [GitHub Copilot Instructions](#15-github-copilot-instructions)
16. [GTM Positioning & Messaging Rules](#16-gtm-positioning--messaging-rules)
17. [Adversarial Critique & Prerequisites](#17-adversarial-critique--prerequisites)
18. [SAM.gov, NSF, Grant Context](#18-samgov-nsf-grant-context)
19. [TrustSignal-Reddit (Devvit)](#19-trustsignal-reddit-devvit)
20. [Open Issues & Next Actions](#20-open-issues--next-actions)

---

## 1. Company Identity & Category

**Formal category:** Cybersecurity / Evidence Integrity Infrastructure  
**Trade show registration:** Cybersecurity (confirmed — not "automation", not "software")  
**Job title:** Founder  
**Stage:** Pre-seed, pre-pilot. MVP live. No external customers yet.  
**Entity:** Federal-only registered LLC (DBA), not yet Delaware C Corp (intentional — Illinois grant eligibility)  
**Location:** Chicago, Illinois

**One-liner (canonical):**  
> "TrustSignal is evidence integrity infrastructure that sits behind existing evidence workflows and provides tamper-evident, audit-time verification of collected artifacts."

**What TrustSignal is NOT:**
- Not automation
- Not a GRC replacement (not Vanta, Drata, Secureframe)
- Not a general workflow tool
- Not "better logs"
- Not a marketplace plugin
- Not a storage product

---

## 2. Core Product Thesis

**The problem:** Most compliance teams are good at collecting evidence but weak at proving that evidence stayed unchanged over time. The gap is between collection and audit-time proof.

**The wedge — post-collection drift:**
- Migrations
- Accidental overwrites
- Silent degradation
- Deliberate manipulation
- Revocation of previously accepted evidence
- Source downtime creating audit uncertainty

**Canonical lifecycle:**
```
collect → receipt → verify → review
```

**Key differentiator:** Mathematical proof of integrity over time — not "trust our logs."

**Simple operator-friendly phrasing:**
- "You already collect evidence. We help you prove it stayed clean."
- "The gap is between collection and audit-time proof."
- "We attach at the ingestion boundary, not inside your system."

---

## 3. Architecture — Sidecar / Middleware Model

**Confirmed decision: TrustSignal is a sidecar/middleware integrity layer, NOT a storage product.**

What this means:
- Customer data stays in customer infrastructure (their S3, Supabase, DMS, database)
- At ingestion, TrustSignal generates a **cryptographic receipt**: hash + metadata binding (timestamp, origin, destination)
- TrustSignal stores **only the receipt** — a mathematical commitment — not the raw artifact
- Later, at audit time: re-hash the live artifact, compare against original receipt
- If anything changed — one bit, one character — the check fails and TrustSignal emits a tamper event

**Why this architecture is correct:**
- Eliminates the PII/data custody objection
- Deployable as a single API call or webhook at intake
- Customer owns the data, TrustSignal owns the proof
- No infrastructure migration required

**Accurate capability statement:**  
> "TrustSignal provides a cryptographic evidence integrity layer that attaches at the ingestion boundary — generating tamper-evident receipts for ingested data artifacts, verifying integrity on demand, and surfacing audit-ready proof without requiring changes to existing storage or workflows."

---

## 4. Canonical Tech Stack

| Layer | Technology | URL |
|---|---|---|
| Frontend | Next.js (v0-signal-new repo) | trustsignal.dev |
| API | Fastify + TypeScript + Prisma | api.trustsignal.dev |
| Auth | Supabase OAuth | — |
| Database | Supabase Postgres (trustsignal-staging) | — |
| Deployment | Vercel (Node 20) | — |
| Billing | Stripe (direct integration) | — |
| Primary IDE | VS Code + GitHub Copilot | — |

**Vercel project IDs:**
- `v0-signal-new` → `prj_N2UtuJ20jPTOxsc80z2dyD2b33Vt`
- API backend → `prj_xhUCkmioUAl0Go6DYD54AFx`
- Team ID: `team_lVuuPkpL0jP1MJW21GEc5TmN`

**Active codebase:** `src/routes/` — Fastify + TypeScript + Prisma  
**Legacy (retiring):** `src/api/` — Node.js http + SQLite + plain JS. Do not extend.

**Package naming:**
- Active: `@trustsignal/core`, `@trustsignal/verifier`
- Retired (backward compat only): `@deed-shield/core`, `@deed-shield/verifier`
- Never introduce new `@deed-shield/*` imports

---

## 5. GitHub Org Map (trustsignal-dev)

```
GITHUB ORG: TRUSTSIGNAL-DEV

v0-signal-new
  Next.js · React · Node 24
  DEPLOYS TO: trustsignal.dev
  STATUS: Production ✓

TrustSignal (monorepo)
  Node.js 20 · Fastify v5 · Prisma
  master → api.trustsignal.dev (Production ✓)
  main → Legacy Frontend (Deprecated)

TrustSignal-Reddit
  Devvit · Reddit platform
  STATUS: Beta (schema paused)

TrustSignal-docs
  Documentation repo

TrustSignal-App
  Separate app

TrustSignal-Verify-Artifact
  Separate verification tool

trustagents
  Python FastAPI oracle service — 8-stage pipeline
  Phase 3 integration flag: trustsignal_handoff_export_enabled=false

bridge (Vercel project, NO repo)
  Reddit backend · bridge-five-kappa.vercel.app
  STATUS: Manual deploys, no CI/CD

trustsignal-github-app (Vercel project, NO repo)
  GitHub webhook handler
  STATUS: Manual deploys, no CI/CD
```

**Note:** All `@deed-shield` references are obsolete. Ignore entirely.

---

## 6. Receipt Format & Anchoring

### Receipt Object Schema (Confirmed)

```typescript
interface Receipt {
  receiptVersion: "2.0";
  receiptId: string;
  receiptHash: string;                // SHA-256 hash of receipt data
  
  receiptSignature: {
    signature: string;                // EdDSA signature (hex)
    alg: "EdDSA";
    kid: string;
  };
  
  status: "clean" | "failure" | "revoked" | "compliance_gap";
  decision: "ALLOW" | "FLAG" | "BLOCK";
  reasons: string[];
  
  fraudRisk: {
    score: number;                    // 0.0 to 1.0
    band: "LOW" | "MEDIUM" | "HIGH";
    signals: string[];
  };
  
  checks: CheckResult[];
  
  // ZK Proof (R&D — not production)
  proofVerified?: boolean;
  zkpAttestation?: {
    proofType: "Halo2";
    circuitId: "revocation-non-membership";
    nonce: string;
  };
  
  // Blockchain Anchoring (R&D — testnet only)
  anchor?: {
    status: "PENDING" | "ANCHORED";
    backend: "EVM_LOCAL" | "POLYGON";
    anchorId?: string;
    txHash?: string;
    chainId?: string;
    anchoredAt?: string;
    subjectDigest?: string;
  };
  
  revocation?: {
    status: "ACTIVE" | "REVOKED";
    revokedAt?: string;
    revokeReason?: string;
  };
  
  createdAt: string;
  updatedAt?: string;
}
```

### Anchoring Decision

**Current state in codebase:**
- `polygonAmoyAnchor.ts` — hash committed on Polygon Amoy testnet (chainId 80002) or PoS Mainnet (chainId 137). Replaces the deprecated Mumbai testnet.
- `halo2Bridge.ts` — ZK proof via compiled Rust binary. **BLOCKER: incompatible with Vercel serverless**

**Recommended anchoring architecture:**
- **Primary:** Polygon PoS (Amoy testnet or PoS mainnet) — tamper-evident on-chain receipt
- **Compatibility layer:** RFC 3161 timestamp for regulated-environment audit compatibility
- **ZK proof:** Roadmap Phase 2 — resolve Vercel binary incompatibility post-May 15th

**What to tell a technical evaluator:**  
> "Receipts are anchored via cryptographic hash commitment on Polygon PoS with on-chain transaction proof, optionally paired with RFC 3161-compliant timestamps for regulated-environment audit compatibility. Zero-knowledge proof generation is in active development as a privacy-preserving verification layer."

---

## 7. Technical Debt (P0 Open Issues)

| Issue | Location | Status |
|---|---|---|
| ~~Mumbai testnet hardcoded~~ | ~~`polygonMumbaiAnchor.ts`~~ | **Fixed** — migrated to `polygonAmoyAnchor.ts` (Amoy/PoS) |
| ZK/ZKML binary incompatible with Vercel | `halo2Bridge.ts` + EZKL | Resolve post-May 15th |
| Unauthenticated revocation endpoints | `src/routes/revoke*` | Must auth-gate before any pilot |
| Mocked ZK proof stubs | `packages/core/src/zkp/index.ts` | R&D only — feature-flagged via `TRUSTSIGNAL_ZKP_BACKEND` env var; `[zkp:MOCK]` log label added in this session |
| Supabase Postgres — 0 migrations run | trustsignal-staging | Schema exists in Prisma only |
| Dual server architecture debt | `src/api/` vs `src/routes/` | Legacy retiring, do not extend |
| Prisma schema deleted | Prior cleanup session | Recovery from git history delegated to Gemini; 8 failing test suites |
| Ephemeral wallet (blockchain) | `src/services/blockchain.ts` | No persistent key — risk of receipt loss |
| "experimental" text on public API example | demo.trustsignal.dev | Remove before May 15th |

---

## 8. Code Fixes Completed

Confirmed as done (as of April–May 2026):
- Package namespace migration: `deed-shield` → `trustsignal` across all 5 workspaces + string references ✓
- Devvit config modernized: JSON → YAML ✓
- Auth enforcement on metrics endpoint ✓
- Metric prefixes rebranded: `deedshield_` → `trustsignal_` across observability stack ✓
- Env validation wired in at startup ✓
- Prisma indexes + RLS migrations codified ✓
- Mumbai testnet (`polygonMumbaiAnchor.ts`) → Polygon Amoy/PoS (`polygonAmoyAnchor.ts`) ✓
- ZK dev-only mode labeled `[zkp:MOCK]` in logs ✓ (added in this session)

Still blocking:
- Prisma migrations to prod DB (`prisma migrate deploy` against `DATABASE_URL`)
- Supabase RLS to prod (`supabase db push`)
- GitHub + Vercel wiring for bridge + trustsignal-github-app

---

## 9. Whitepaper Corrections (v2.3 → v2.4)

The v2.3 whitepaper contained material misrepresentations corrected in v2.4:

| Claim in v2.3 | Actual State |
|---|---|
| ZK proofs production-ready with Halo2 benchmarks | ZK proofs are mocked (P2 roadmap). No real Halo2 circuits live. |
| Blockchain anchoring is live | Testnet-only with ephemeral wallets. Not anchoring receipts live. |
| Partner integrations with Vanta/Drata/Scrut operational | Portal UIs exist; no actual data exchange. |
| All API endpoints require OAuth2 token | Some endpoints lack auth middleware (P0). |
| Rate limiting enforced by tier | Exists in theory; not enforced in production. |
| GitHub App and bridge have CI/CD | Both deploy manually; no GitHub repos connected. |

**Bottom line:** TrustSignal v2.3 read like a prospectus for a mature product. It is actually a well-architected MVP with credible R&D directions. The gap was costing investor trust. v2.4 corrects to match actual stage.

---

## 10. ICE Mortgage Technology — May 15th Meeting Prep

**Contact:** Kimberlee Foster  
**Date:** May 15, 2026  
**Goal:** Validate repurchase risk pain point, get to a pilot conversation

### Core Pain Point to Lead With

**Repurchase risk (loan buyback triggered by evidence tampering post-sale).**

If a loan gets flagged post-sale because a bank statement looks altered, the originator eats the buyback. TrustSignal's receipt at ingestion is a defensible timestamp that the document was clean when it entered the file.

### Demo Scenario (Mortgage-Specific)

A borrower uploads a bank statement → TrustSignal generates a receipt at ingestion → loan is sold to Fannie Mae → six months later there is a repurchase demand → you pull the receipt and prove the document was clean on day one.

**NOT the Cook County deed scenario** — that is too far from ICE's world.

### Five-Minute Core Pitch

**Sentence 1 — The Problem:**  
"When a loan is sold to the secondary market, the originator is on the hook if any document in the file is later found to be altered. The integrity of those documents has to be provable months or years after the fact."

**Sentence 2 — The Gap:**  
"Current systems validate documents at intake. But there is no independent proof that those documents have not changed between intake and audit time — especially after migrations, system upgrades, or vendor changes."

**Sentence 3 — The Solution:**  
"TrustSignal attaches at the point of document ingestion and generates a cryptographic receipt — a mathematical fingerprint bound to a timestamp — that can be independently verified at any point in the future."

**Sentence 4 — How It Works:**  
"We do not store the document. We store a hash. If the document is unchanged, the hash matches. If a single character changed, the hash fails. This is mathematically provable, not a log entry someone could alter."

**Sentence 5 — Business Outcome:**  
"For lenders, this means faster audits, fewer exceptions, and defensibility against repurchase demands. For ICE, it is a new value-add layer for the Encompass ecosystem — without replacing the platform."

### Pilot Scope

- **Duration:** 60 days
- **Scale:** One mid-market lender, 100 documents
- **SLA targets:** <500ms latency, zero false positives
- **Pilot ask:** One workflow, one document type (e.g., bank statements), one lender

### Technical Blockers to Fix Before May 15th

1. **Mumbai testnet hardcoding** in `polygonMumbaiAnchor.ts` — swap to Amoy/PoS mainnet (**done**)
2. **Remove "experimental" from public API response example** on demo site
3. **ZK/ZKML binary incompatibility with Vercel** — can defer, but do not lead with ZK in the meeting

### What NOT to Lead With at ICE

- ZK proofs — mortgage buyers do not evaluate on this; it is a backend implementation detail
- Encompass Partner Connect concerns — May 15th is exploratory, not a security review
- MISMO format — irrelevant to the integrity layer

### Seven Scripted Objections (Key Ones)

**"We already validate documents at intake."**  
> "You validate at intake. We focus on what happens after — between collection and audit time, across migrations, vendor changes, and secondary market review."

**"Our logs show document history."**  
> "Logs can be altered by anyone with database access. A cryptographic receipt cannot be altered retroactively without the hash failing. That is the difference between 'trust our logs' and mathematical proof."

**"This sounds like extra infrastructure."**  
> "It is a single API call or webhook at ingestion. No workflow changes, no new storage, no new UI. Same storage, same processes — just a receipt generated at intake."

**"What about PII and data custody?"**  
> "We never see the document. We receive a hash and return a signed receipt. Your data stays in your infrastructure."

---

## 11. Demo Site

**URL:** demo.trustsignal.dev  
**Status:** Live (confirmed via web fetch)  
**Content:** ICE-specific framing — "Evidence Integrity for ICE Mortgage Platform", "6-Layer Integration with ICE Mortgage Technology"

**Pre-meeting checklist:**
- Remove "experimental blockchain anchoring" language anywhere it appears
- Walk through end-to-end on the device you are bringing — every scroll, animation, click
- Test on a different network than home wifi (coffee shop/hotspot) to catch latency issues

**Namespace note:** `trustsignal.io` is an Indian SMS company with strong SEO. Know this so you are not caught off guard if ICE searches and lands there.

---

## 12. Privacy Policy & Data Handling

### What TrustSignal Stores

- SHA-256 hash of the artifact (not the raw artifact)
- Receipt metadata: timestamp, origin, decision, check results
- Operator identity (API key ID, email)
- IP address + request logs

### What TrustSignal Does NOT Store

- Raw document content
- PII extracted from documents (names, SSNs, addresses)
- OCR or document reading results

### When Someone Asks "What Data Do You Store?"

Honest answer:
- "We store hashes, receipts, signatures, and an audit trail linking verifications to operators"
- "We do not store the document itself"
- "Records live in Supabase (us-east-1) unless you request deletion"

### Compliance Roadmap

- SOC 2: Q2 target
- GDPR: Q3 target
- FDA 21 CFR Part 11: On demand

---

## 13. API Reference (Confirmed Endpoints)

### Authentication

OAuth2 client_credentials flow — exchange `client_id` + `client_secret` for JWT Bearer token.

### Endpoints

```
POST /v1/receipts          — Generate a receipt at ingestion
POST /v1/verify            — Verify artifact against existing receipt
POST /v1/receipts/{id}/revoke  — Revoke a receipt (auth-gated)
POST /v1/compliance-gaps   — Log a compliance gap
GET  /api/v1/receipt/{id}  — Retrieve a receipt
```

### Rate Limits by Tier

| Tier | Limit |
|---|---|
| FREE | 10 req/min |
| PRO | 100 req/min |
| ENTERPRISE | Custom |

### Canonical Status Labels

Only use these — no others:
- `clean`
- `failure`
- `revoked`
- `compliance_gap`

---

## 14. Warp Oz Agent Setup

**Environments created (confirmed):**
- `trustsignal-api` — Environment ID: `Det63GoRlfZsPjgQwjHHix`
- `trustsignal-docs` — Environment ID: `5EwXuHtNWoZ5J47YaIYFNP`

Both use `node:20`. Setup commands: `npm ci` + `npx prisma generate`.

**GitHub Actions workflows pushed:**
- CI pipeline
- Oz PR review (triggers on PR open/update)
- Oz respond-to-comment (triggers on `@oz-agent`)
- Oz fix-failing-checks

**GitHub and Linear integrations:** Must be wired manually via the Oz web dashboard (CLI does not support it). No Slack integration.

**Warp team:** Must be created at `app.warp.dev` and environments transferred to team scope before Linear integration works.

---

## 15. GitHub Copilot Instructions

File location: `github.com/trustsignal-dev/<repo>/.github/copilot-instructions.md`

Key rules Copilot must follow:
- Modern layer only: `src/routes/` — Fastify + TypeScript + Prisma
- Legacy `src/api/` — do not extend
- Never introduce new `@deed-shield/*` imports
- Do not mock ZK proofs or fake blockchain anchoring in non-test code
- Any unimplemented feature must be feature-flagged and labeled `MOCK` in logs
- Every new endpoint must have JWT auth + rate limiting
- Canonical status labels only: `clean`, `failure`, `revoked`, `compliance_gap`
- Multi-agent review phase before finalizing any output

---

## 16. GTM Positioning & Messaging Rules

### Category Sentence

> "TrustSignal is evidence integrity infrastructure that sits behind existing evidence workflows and provides tamper-evident, audit-time verification of collected artifacts."

### Anti-Competition Reframe (for Vanta/Drata conversations)

- Compliment what they already do well
- Frame TrustSignal as the step **after** evidence collection and workflow automation
- Avoid suggesting they are missing core compliance functionality
- Emphasize shared-customer audit defensibility

### Anti-Integration Reframe

Never lead with:
- "We integrate into your system"
- "We need deep access to your API"

Lead with:
- "We operate at the ingestion boundary"
- "We sit one layer below the product surface"
- "We use your API as the transport layer"

### Pricing

Tier-based subscriptions. No per-verification micro-charges. Positioned as premium.

### Vanta

Dead thread — stopped responding. Not active pipeline.

---

## 17. Adversarial Critique & Prerequisites

Three prerequisites before enterprise or platform partners will engage seriously:

1. **A named customer with a documented tampering incident** — not hypothetical
2. **Big 4 auditor endorsement of the receipt format**
3. **TrustSignal's own SOC 2 Type II**

The real red-team prompt for TrustSignal:
> "Act as a cynical pre-seed VC and a compliance infrastructure buyer. TrustSignal claims to be evidence integrity infrastructure for mortgage workflows. You have 10 minutes to identify the three fastest ways this pitch falls apart technically, commercially, and legally before the May 15th ICE meeting."

---

## 18. SAM.gov, NSF, Grant Context

- SAM.gov: Submitted ✓
- UEI: Active ✓
- GATA prequalification: Active (Illinois) ✓
- research.gov access: Active ✓
- NSF EAGER / SBIR eligible — framing: high-risk cyberinfrastructure R&D
- R&D direction: ZKML (zero-knowledge machine learning for fraud detection), non-membership proofs, Poseidon-based nullifiers via Halo2 circuits
- Entity: Federal-only registered LLC (DBA). Not yet Delaware C Corp — intentional (preserves Illinois grant eligibility)

**Important:** ZK/blockchain must be explicitly framed as R&D prototypes under NSF grant evaluation — not production features — in any capability statement.

---

## 19. TrustSignal-Reddit (Devvit)

Two distinct Devvit apps — do not conflate:
- **TrustSignal-Reddit** — mod trust tool
- **The Daily Docket** — daily game app

Config: YAML-based (`devvit.yaml`). `devvit.json` at repo root is a legacy artifact — ignore.

Fixed:
- `devvit.json` deleted from Karma-Court
- `devvit.yaml` — removed invalid `update: true` field
- `http` permission added to `devvit.yaml` (required for `Devvit.configure({ http: true })`)

Deploy command:
```bash
cd ~/TrustSignal-Reddit/trustsignal-reddit-devvit
npx devvit upload
```

---

## 20. Open Issues & Next Actions

### Pre-May 15th (Hard Deadline)

- [x] Swap Mumbai → Polygon Amoy or PoS mainnet in `polygonAmoyAnchor.ts`
- [ ] Remove "experimental" from public API response example on demo.trustsignal.dev
- [ ] End-to-end test demo.trustsignal.dev on meeting device + external network

### Post-May 15th

- [ ] Resolve ZK/ZKML binary incompatibility with Vercel serverless
- [ ] Auth-gate all revocation endpoints
- [ ] Run `prisma migrate deploy` against production `DATABASE_URL`
- [ ] Push Supabase RLS via CLI (`supabase db push`)
- [ ] Create GitHub repos for bridge + trustsignal-github-app and wire CI/CD
- [ ] Wire Warp Oz team at `app.warp.dev` — GitHub + Linear integrations via dashboard
- [ ] SOC 2 Type II — start process

### Product Unknowns Still Open

- Exact SDK / API surface (published)
- Exact revocation API state model (confirmed auth gap)
- Customer-facing UI decisions
- Pricing / packaging (tier-based confirmed; tiers not finalized)
- Named design partners (none yet)
- Real pipeline stage by account

---

*End of TrustSignal Conversation Log — May 4, 2026*  
*Compiled from Claude sessions spanning April–May 2026*
