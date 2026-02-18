# Deed Shield — Security Remediation Work Log

**Date:** 2026-02-18  
**Branch:** master  
**Repo:** chrismaz11/Deed_Shield

---

## 🔐 Authentication & Authorization

- Created `requireOrg()` shared authentication helper in `apps/api/src/utils/auth.ts`.
- Refactored `POST /api/v1/verify` — replaced manual `x-api-key` lookup with `requireOrg`.
- Refactored `POST /api/v1/anchor/:receiptId` — replaced manual lookup with `requireOrg`.
- Refactored `POST /api/v1/receipt/:receiptId/revoke` — replaced manual lookup with `requireOrg`.
- Secured `GET /api/v1/receipts` — added `requireOrg` + org-scoped query (`where: { organizationId }`).
- Secured `GET /api/v1/receipt/:receiptId` — added `requireOrg` + ownership check (403 if wrong org).
- Secured `GET /api/v1/receipt/:receiptId/pdf` — added `requireOrg` + ownership check (403 if wrong org).
- Verified `POST /api/v1/receipt/:receiptId/verify` uses `requireOrg`.
- Verified `POST /api/v1/verify/attom` uses `requireOrg`.
- Zero hand-rolled API key lookups remain — single chokepoint for all auth.

## 🏢 Multi-Tenant Isolation & Metering

- Added `organizationId` field to `RequestLog` model in `apps/api/prisma/schema.prisma`.
- Wired `organizationId` into `RequestLog.create` calls in `/verify` endpoint.
- Wired `organizationId` into `logVerificationEvent` for audit trail.
- `GET /receipts` returns **only** the authenticated org's receipts.
- `GET /receipt/:id` returns 403 if receipt belongs to a different org.
- `GET /receipt/:id/pdf` returns 403 if receipt belongs to a different org.
- Removed duplicate `GET /api/v1/receipts` endpoint definition.

## 🧪 Testing

- Added `x-api-key` header to all test API calls (verify, receipt, revoke, etc.).
- Test: Org B `GET /receipts` returns empty — proves no cross-tenant data leak.
- Test: Org B `GET /receipt/:id` returns 403 — proves ownership enforcement.
- Test: Org B `GET /receipt/:id/pdf` returns 403 — proves PDF access control.
- Test: `RequestLog` entries have `organizationId` populated — proves metering works.
- Test: Unauthenticated `GET /receipts` returns 401 — proves auth required.
- All 5 tests passing (1 feature integration + 4 tenant isolation).

## 🗄️ Database

- Changed `schema.prisma` provider from `sqlite` to `postgresql`.
- `DATABASE_URL` now expected to be a PostgreSQL connection string.
- Added production startup guard — API refuses to boot if `DATABASE_URL` lacks `sslmode=require|verify-full|verify-ca` when `NODE_ENV=production`.

## 🧹 Git History Scrubbing

- Ran `git filter-branch` to remove `.env.local` from all 21 commits.
- Ran `git filter-branch` to remove `attestations.sqlite` from all commits.
- Ran `git filter-branch` to remove `apps/api/.env` from all commits.
- Deleted `refs/original/*` backup refs left by `filter-branch`.
- Ran `git reflog expire --expire=now --all`.
- Ran `git gc --prune=now --aggressive` to physically remove old objects.
- Verified: scanned every commit in history — zero sensitive files found.
- Force-pushed rewritten history to GitHub.

## 📝 .gitignore Hardening

- Added `attestations.sqlite` to `.gitignore`.
- Added `**/.env` pattern to `.gitignore`.
- Confirmed `.env.local` is covered by existing patterns.

## 🧹 Lint & Dead Code Cleanup

- Fixed import ordering — `node:*` → third-party → `@deed-shield/core` → local `./`.
- Merged duplicate `@deed-shield/core` import blocks (was imported twice).
- Removed unused `ReceiptListRecord` type.
- Removed unused `DatabasePropertyVerifier` class (40 lines of dead code).
- Removed unused `contract` variable in `BlockchainVerifier`.
- Removed unused `Contract` and `JsonRpcProvider` imports from `ethers`.
- Prefixed unused params with `_` (`_county`, `_state` in `DatabaseCountyVerifier`).
- Fixed `as any` cast → proper union type `'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN'`.
- Fixed test file import ordering.
- Result: 0 ESLint errors remaining (only Prisma v7 informational notice).

## 📄 Documentation Created

- `apps/api/SETUP.md` — developer setup guide (PostgreSQL, env vars, running locally).
- `apps/api/.env.example` — template with placeholder values, no secrets.
- `SECURITY_CHECKLIST.md` — comprehensive security posture document with:
  - ✅ items verified in-repo.
  - 🔒 items enforced by code (TLS guard).
  - 📋 items requiring infra/ops action.
  - Section 5: Dependency security status.
  - Section 6: Pre-deployment verification commands.
  - Section 7: Rotation checklist with owner assignments.

## 🔗 GitHub Actions / Security Tooling

- Dependabot vulnerability alerts enabled via GitHub API.
- Dependabot alert #45 (`ajv` ReDoS / CVE-2025-69873) dismissed with rationale — dev-only dependency, production uses patched `ajv@8.18.0`.
- `npm audit` confirms 0 vulnerabilities across all dependencies.
- Noted: GitHub secret scanning requires Advanced Security (Enterprise) — documented `git-secrets` / `trufflehog` as alternatives.

## 📦 Commits Pushed

1. `323b804` — docs: add developer setup guide and .env.example template.
2. `dd68b39` — test: add cross-tenant isolation and metering verification tests.
3. `15e7f6b` — security: add TLS enforcement guard, purge backup refs, and create security checklist.
4. `f02583f` — chore: fix all lint errors — clean imports, remove dead code, prefix unused params.
5. `25cfa14` — docs: finalize security checklist — dismiss Dependabot, enable alerts, document rotation.

## 📋 Remaining (Out-of-Repo, Documented in SECURITY_CHECKLIST.md §7)

| #   | Action                                  | Owner |
| --- | --------------------------------------- | ----- |
| 7.1 | Rotate `ATTOM_API_KEY`                  | Ops   |
| 7.2 | Rotate `OPENAI_API_KEY`                 | Ops   |
| 7.3 | Rotate `PRIVATE_KEY` (Ethereum wallet)  | Ops   |
| 7.4 | Rotate `DATABASE_URL` password          | Ops   |
| 7.5 | Confirm DB encryption at rest           | Infra |
| 7.6 | Verify DB TLS certificate (real CA)     | Infra |
| 7.7 | Create separate staging/prod credentials| Ops   |
| 7.8 | Install pre-commit secret scanning hook | Dev   |
