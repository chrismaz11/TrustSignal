# ATTOM Cross-Check Verification (Cook County)

**Purpose:** cross-check parsed Cook County deeds against ATTOM property data to provide PASS/WARN/FAIL signals without storing PII beyond what is required for the report.

## Inputs
- `DeedParsed` payload (grantor/grantee, legal description text, PIN, address, recording metadata, notary info).
- ATTOM API key (`ATTOM_API_KEY`) and optional base URL (`ATTOM_BASE_URL`, default `https://api.gateway.attomdata.com`).

## Flow
1. Normalize deed PIN/address/legal description.
2. Lookup ATTOM by PIN when available; otherwise by address. Retry on 429/5xx (max 3) with 7s timeout.
3. Select best ATTOM candidate (exact APN match first, otherwise best address similarity).
4. Compare and produce checks:
   - **PIN/APN** exact/partial/mismatch.
   - **Address** street+ZIP / street / city+state match (soft).
   - **Owner** token-overlap score (names never logged; report only score).
   - **Legal description** tokens from ATTOM lot/block/tract/subdivision.
   - **Temporal sanity** (execution vs recording, future dates).
   - **Notary expiration** sanity.
5. Compute weighted `matchConfidence` (PIN 0.55, address 0.25, owner 0.15, legal 0.05).
6. Return `VerificationReport` with summary, checks, evidence, and canonical hash of `PIN|legal|docNumber|recordingDate`.

## API
- `POST /api/v1/verify/attom` (Cook County only)
  - Body: `DeedParsed`
  - Response: `VerificationReport`

## Privacy boundaries
- No ATTOM or deed names are logged; owner comparisons use token overlap only.
- Only required fields appear in the report; names are omitted/redacted.
- ATTOM responses are not persisted; only report is returned to caller.

## Testing
- Unit/integration-like tests live in `packages/core/src/attom/*.test.ts` and use mock clients/fixtures; no real network calls.

## What this does NOT do
- Does not treat ATTOM as ground truth; deed legal description remains authoritative.
- Does not persist ATTOM payloads or store PII.
- Does not anchor or alter existing receipt logic; it produces an additive cross-check report.
