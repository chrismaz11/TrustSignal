# TrustSignal x Vanta Call Command Center

Date: 2026-03-05  
Call date: 2026-03-06

## 1) Executive Status (Use This First)

Current repo status for call:
- Docs package: ready
- Core/API TypeScript build: passing
- Local verification demo (`/api/v1/verify` path): blocked without working `DATABASE_URL`

What this means:
- You are ready to run the meeting narrative and show integration assets.
- You are **not** ready to run a full local verify flow on this machine until DB config is fixed.

## 2) Evidence From Readiness Checks

Checked on 2026-03-05:

- `git status`
  - Branch is clean except local editor setting: `.vscode/settings.json`
- `npm --workspace packages/core run build`
  - Pass
- `npm --workspace apps/api run build`
  - Pass
- `npm --workspace apps/api run test`
  - Fail (primary blocker: `DATABASE_URL` not set; DB-backed routes return `503`)
- Live API smoke (`apps/api` with demo API key, no DB)
  - `GET /api/v1/health` => `200` (`status: degraded`, DB not ready)
  - `GET /api/v1/integrations/vanta/schema` => `200`
  - `GET /api/v1/synthetic` => `503` (`Database unavailable`)

## 3) What To Demo Tomorrow (Recommended)

Primary demo plan:
1. Talk track + architecture + endpoint mapping.
2. Show schema contract and payload examples.
3. Run CLI/webhook flow **against staging** (or any env with working DB + API key).

Use these assets in order:
1. `docs/partnership/vanta-2026-03-06/00_CONSOLIDATED_BRIEF.md`
2. `docs/partnership/vanta-2026-03-06/02_INTEGRATION_ARCHITECTURE.md`
3. `docs/partnership/vanta-2026-03-06/11_ENDPOINT_MAPPING.md`
4. `docs/partnership/vanta-2026-03-06/05_DEMO_SCENARIOS_AND_SCRIPT.md`
5. `docs/partnership/vanta-2026-03-06/12_10_MIN_TALK_TRACK.md`

## 4) Exact Commands You’ll Need

Terminal A (mock webhook sink):

```bash
node scripts/mock-vanta-webhook-listener.mjs
```

Terminal B (partner demo runner):

```bash
TRUSTSIGNAL_BASE_URL=<staging-or-prod-base-url> \
TRUSTSIGNAL_API_KEY=<api-key> \
VANTA_CALLBACK_URL=http://localhost:8787/webhooks/trustsignal \
TRUSTSIGNAL_WEBHOOK_SECRET=demo-webhook-secret \
node scripts/vanta-partner-demo.mjs
```

Quick schema check:

```bash
curl -s -H "x-api-key: <api-key>" \
  <base-url>/api/v1/integrations/vanta/schema | jq .
```

Playwright UI run (automates the demo page and captures screenshot/report):

```bash
TRUSTSIGNAL_BASE_URL=<staging-or-prod-base-url> \
TRUSTSIGNAL_API_KEY=<api-key> \
npm run demo:playwright
```

Outputs:
- screenshot: `output/playwright/vanta-command-center-*.png`
- report JSON: `output/playwright/vanta-command-center-*.json`
- video: `output/playwright/videos/vanta-command-center-*.webm`

## 5) Go/No-Go Checklist (Simple)

Green before call:
- [ ] `TRUSTSIGNAL_BASE_URL` points to environment with working DB
- [ ] Valid `TRUSTSIGNAL_API_KEY` confirmed
- [ ] Webhook listener running locally
- [ ] `scripts/vanta-partner-demo.mjs` completes successfully once

If one item fails:
- Switch to architecture + API contract walkthrough and payload examples.
- Do not force broken live verification demo.

## 6) Windsurf “Code Maps” Quick Decoder

You can ignore these for tomorrow’s partnership call unless asked about ownership risk.

If needed:
- `output/security-ownership-map/*/summary.json`
  - Top-level summary (ownership concentration, bus-factor hotspots)
- `files.csv`
  - Per-file ownership and sensitivity tags
- `people.csv`
  - Contributor-level ownership stats
- `cochange.graph.json`
  - File co-change clusters (architecture coupling hints)

One-line interpretation from current outputs:
- Sensitive code ownership is heavily concentrated (single maintainer across auth/api/db-sensitive areas).

## 7) Risks You Should Be Ready To State Clearly

1. Local DB-backed verify route is not currently runnable without `DATABASE_URL`.
2. Readiness docs are strong, but live demo quality depends on environment config, not docs alone.
3. If live verification is unavailable, position this as an integration design + contract review session with a follow-up technical run.

## 8) 2-Minute Fallback Script (If Live Verify Breaks)

Say this directly:
- "We validated the integration contract and webhook shape."
- "The verification API path is ready in staging once credentials are enabled."
- "Let’s finalize your preferred auth mode and event contract now, then run a joint technical verification session immediately after."

## 9) Minute-by-Minute Run Sheet (Use Live In Call)

### T-20 to T-10 (Before Joining)

1. Open these files in tabs:
   - `docs/partnership/vanta-2026-03-06/00_CONSOLIDATED_BRIEF.md`
   - `docs/partnership/vanta-2026-03-06/02_INTEGRATION_ARCHITECTURE.md`
   - `docs/partnership/vanta-2026-03-06/11_ENDPOINT_MAPPING.md`
   - `docs/partnership/vanta-2026-03-06/12_10_MIN_TALK_TRACK.md`
2. Open Terminal A:
   - `node scripts/mock-vanta-webhook-listener.mjs`
3. Open Terminal B and paste (do not run yet):

```bash
TRUSTSIGNAL_BASE_URL=<staging-or-prod-base-url> \
TRUSTSIGNAL_API_KEY=<api-key> \
VANTA_CALLBACK_URL=http://localhost:8787/webhooks/trustsignal \
TRUSTSIGNAL_WEBHOOK_SECRET=demo-webhook-secret \
node scripts/vanta-partner-demo.mjs
```

4. Confirm schema endpoint once:

```bash
curl -s -H "x-api-key: <api-key>" \
  <base-url>/api/v1/integrations/vanta/schema | jq -r '.schemaVersion'
```

Expected: `trustsignal.vanta.verification_result.v1`

### Minute 0:00-1:00 (Open)

Say:
- "Goal today is to align on a 30-day technical evaluation and one pilot workflow."
- "Vanta remains system-of-record for compliance workflows; TrustSignal provides cryptographic verification evidence."

### Minute 1:00-2:30 (Problem + Why Now)

Say:
- "Current pain is manual document authenticity checks and inconsistent evidence quality."
- "We reduce review friction while improving audit defensibility."

### Minute 2:30-4:00 (Architecture)

Open `02_INTEGRATION_ARCHITECTURE.md`.

Say:
- "Vanta sends verify request."
- "TrustSignal returns decision + normalized status + receipt hash."
- "Vanta stores payload in existing control/evidence timeline."

### Minute 4:00-5:30 (Contract Confidence)

Open `11_ENDPOINT_MAPPING.md` and `03_VANTA_PARTNER_API_OPENAPI.yaml`.

Say:
- "We can run on existing `/api/v1/*` now and provide stable `/partner/v1/*` aliasing for rollout."
- "Webhook contract is fixed and signed."

### Minute 5:30-7:30 (Live Demo Block)

1. In Terminal B, run the prepared command.
2. In Terminal A, show webhook event reception + signature validity.
3. In Terminal B output, highlight:
   - `receiptId`
   - `normalizedStatus`
   - `decision`
   - webhook delivery status

Say:
- "This is the evidence object Vanta can ingest directly."
- "No raw document payload is required in the evidence contract."

### Minute 7:30-8:30 (Security + Operations)

Open `06_INFRA_SLA_SECURITY_PACKAGE.md`.

Say:
- "We are explicit: SOC 2 readiness in progress, not claiming certification."
- "Pilot includes defined SLA, auth model options, and escalation path."

### Minute 8:30-9:30 (Commercial + Pilot Ask)

Say:
- "Proposal: 30-day technical evaluation, one workflow, named owners on both sides."
- "Success metric: evidence payload accepted in Vanta flow with sub-2-second pilot response."

### Minute 9:30-10:00 (Close + Next Step)

Ask:
1. "Which workflow should be first: real estate, healthcare, or legal?"
2. "Who is the engineering owner on your side?"
3. "Can we book the technical working session for next week now?"

## 10) Branching Script If Demo Fails Mid-Call

If CLI demo fails:
1. Say: "I’ll switch to contract-first mode so we still use time productively."
2. Open `09_API_EXAMPLES.md` and walk request/response payloads.
3. Open `04_WEBHOOK_CONTRACT.md` and confirm signature/header model.
4. Confirm next step: "We run a joint technical validation session with live credentials immediately after."

Never do:
- Do not retry broken commands repeatedly on the call.
- Do not debug infra live for more than 30 seconds.
