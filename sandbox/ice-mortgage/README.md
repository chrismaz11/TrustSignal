# ICE Mortgage Technology — TrustSignal Sandbox

**Status: `sandbox` `demo-ready`**

Simulates a live ICE Mortgage Technology (Encompass) integration without requiring real API credentials or network access. Runs five closing scenarios against the full TrustSignal verification API in-process and saves results to `sandbox-results/` as JSON.

---

## What it tests

| # | Scenario | Expected outcome |
|---|---|---|
| 1 | Clean closing — valid notary, matching state | `decision: ALLOW`, `status: clean` |
| 2 | Notary commission state mismatch (CA notary, IL closing) | `decision: FLAG or BLOCK` |
| 3 | Tampered seal payload | `decision: FLAG or BLOCK` |
| 4 | Rapid-fire duplicate submission (same parcel) | `decision: FLAG or BLOCK` |
| 5 | Revocation flow — verify → revoke → confirm revoked | `status: revoked` |

---

## How to run

From `TrustSignal/apps/api/`:

```bash
# Requires a running Supabase/Postgres database
export DATABASE_URL=postgresql://...

# Run only the sandbox tests
npx vitest run --reporter=verbose ../../sandbox/ice-mortgage/ice-sandbox.test.ts
```

Results are saved automatically to `sandbox/ice-mortgage/sandbox-results/ice-mortgage-<timestamp>.json`.

---

## File structure

```
sandbox/ice-mortgage/
├── mock-ice-api.ts       ICE Encompass loan fixtures (5 scenarios, no real PII)
├── ice-adaptor.ts        Maps Encompass loan → TrustSignal BundleInput
├── ice-sandbox.test.ts   Integration test suite (Vitest)
├── sandbox-results/      Auto-generated result files (gitignored except .gitkeep)
└── README.md
```

---

## Notes

- No real ICE credentials, API keys, or borrower PII are used. All data is synthetic.
- The sandbox uses `TRUSTSIGNAL_LOCAL_DEV_API_KEYS` for auth — dev-only pattern, not production.
- To adapt for a real Encompass integration, replace `mock-ice-api.ts` with an HTTP client that calls the live Encompass Developer Connect API and pass the response through `ice-adaptor.ts`.
- Results in `sandbox-results/` are suitable for audit evidence packages and partner demos.
