# ICE Mortgage Demo Readiness - 2026-04-27

## Current Validation Status

### v0-signal-new
- Typecheck: PASS
- Tests (Vitest): PASS
- Production build: PASS
- Residual warning: baseline-browser-mapping data age warning from upstream package data freshness.
- Middleware deprecation warning: RESOLVED by migrating to proxy.ts.

### TrustSignal (API monorepo)
- Full validate (lint + typecheck + tests + build): PASS
- Security audit: no high/critical findings reported.
- Turbopack root warning and SWC mismatch warning: RESOLVED.

### TrustSignal-Verify-Artifact
- validate:local: PASS
- build: PASS
- dist drift check: dist/index.js differs from HEAD and must be committed before release.

## Branch Alignment Snapshot

### v0-signal-new
- Current branch: docs/standardize-messaging
- Target branch: main
- Divergence vs origin/main: 13 behind, 1 ahead
- Working tree: dirty (many staged/unstaged and untracked files)

### TrustSignal (API monorepo)
- Current branch: master
- Target branch: master
- Divergence vs origin/master: 0 behind, 0 ahead
- Working tree: dirty

### TrustSignal-Verify-Artifact
- Current branch: cm/merge-main
- Target branch: main
- Divergence vs origin/main: 15 behind, 0 ahead
- Working tree: dirty

## Safe Branch Alignment Procedure (non-destructive)

Run this sequence in each repo with local changes:

1. Create a safety branch from current state.
2. Commit all intended local changes.
3. Fetch origin and inspect divergence.
4. Rebase or merge onto target branch.
5. Re-run validations.
6. Push target branch.

Example command sequence (adapt per repo):
- git checkout -b chore/ice-demo-hardening-2026-04-27
- git add -A
- git commit -m "chore: harden demo readiness"
- git fetch origin
- git checkout main
- git pull --ff-only origin main
- git merge --no-ff chore/ice-demo-hardening-2026-04-27
- run validations
- git push origin main

For TrustSignal target branch is master, not main.

## Go/No-Go Checklist

### Go criteria
- trustsignal.dev build passes and deploy is green.
- api.trustsignal.dev build and smoke routes pass.
- Verify Artifact action package rebuilt and dist committed.
- OAuth login flow works in demo env (Google + GitHub).
- API key create/list/revoke works and logs events.
- Stripe checkout and portal links open; webhook verified.
- Live walkthrough at demo.trustsignal.dev confirms message: same storage, same UI, same process, cryptographic layer underneath.

### No-go triggers
- Any failing typecheck/test/build in any of the three repos.
- Action dist/index.js not regenerated and committed.
- demo.trustsignal.dev not live at time of sharing.
- API auth, key lifecycle, or billing webhook paths failing in runtime checks.

## Demo Runbook (ICE framing)

Primary surface: demo.trustsignal.dev

1. In demo.trustsignal.dev, show borrower upload of a bank statement during normal lender intake.
2. Show TrustSignal issuing a signed receipt at ingestion and storing the receipt ID with the loan record.
3. Show the loan-transfer step to Fannie Mae while preserving the receipt reference in the transfer package.
4. Advance to the six-month repurchase demand moment and request proof of original document state.
5. Pull the original receipt and verify the bank statement is cryptographically identical to day-one ingestion.

Backup only (if network/demo host outage): local scripted demo.

## Pilot Ask (Do Not Leave Meeting Without This)

Propose one scoped pilot before meeting close:

- Pilot partner: one lender
- Document scope: one document type only (bank statements or appraisals)
- Duration: 60 days
- Success metric: percentage of scoped loan files where the original ingestion receipt can be retrieved and used to resolve document-integrity questions during post-close QC/repurchase review

Suggested close language:

"Let's run a 60-day pilot with one lender and one document type. We will measure whether your team can pull day-one receipts fast enough to resolve post-close document integrity questions without relying on interpretation of log history alone."

## Objection Prep: "We Already Have Audit Logs"

Use this answer:

Audit logs prove the system recorded an event. They do not prove the document itself was unchanged. TrustSignal receipts are bound to the document's cryptographic state, not to the system's record of it. That is the integrity gap TrustSignal closes.

## Notes

- The baseline-browser-mapping warning in v0-signal-new is currently non-blocking and persisted after upgrading to latest available package.
- TrustSignal API test scope excludes legacy suites referencing removed src/* paths; maintained suites and build pipeline are green.
