# Deed Shield — Security & Production Readiness Checklist

> This document tracks the security posture of the Deed Shield API.
> Each item is either ✅ (verified in-repo), 🔒 (enforced by code), or 📋 (requires infra/ops verification).

---

## 1. Secrets & Repository Hygiene

| #   | Requirement                                                       | Status | Evidence                                                                                                                                                        |
| --- | ----------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.1 | No `.env`, `.env.local`, or secret files in git history           | ✅     | `git filter-branch` rewrite on 2026-02-18. Verified via `git rev-list --all \| xargs git ls-tree -r --name-only \| grep .env` returns empty.                    |
| 1.2 | `.gitignore` blocks `.env*`, `*.sqlite`, secret files             | ✅     | See `.gitignore` — covers `**/.env`, `.env.local`, `attestations.sqlite`.                                                                                       |
| 1.3 | `.env.example` provided with placeholder values (no real secrets) | ✅     | `apps/api/.env.example` — contains only empty strings and `localhost` URLs.                                                                                     |
| 1.4 | Developer setup guide documents how to obtain secrets             | ✅     | `apps/api/SETUP.md` — references team leads / secrets manager.                                                                                                  |
| 1.5 | GitHub secret scanning enabled                                    | 📋     | Verify at repo Settings → Code security → Secret scanning.                                                                                                      |
| 1.6 | Rotate any secrets that were ever committed                       | 📋     | All API keys, DB passwords, and private keys that existed in `.env.local` or `apps/api/.env` prior to the scrub **must be rotated**. Treat them as compromised. |

## 2. Database Security

| #   | Requirement                                  | Status | Evidence                                                                                                                                                |
| --- | -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Schema uses `postgresql` provider            | ✅     | `apps/api/prisma/schema.prisma` line 6.                                                                                                                 |
| 2.2 | TLS enforced on DB connections in production | 🔒     | `server.ts` startup guard rejects `DATABASE_URL` without `sslmode=require\|verify-full\|verify-ca` when `NODE_ENV=production`.                          |
| 2.3 | Encryption at rest on DB volume              | 📋     | Must be verified on the hosting provider (Render, AWS RDS, Supabase, etc.). All major providers support this — enable it.                               |
| 2.4 | Separate DB credentials per environment      | 📋     | Production, staging, and development must use distinct credentials with least-privilege grants.                                                         |
| 2.5 | DB user has minimal required permissions     | 📋     | Production DB user should have `SELECT, INSERT, UPDATE` only — no `DROP`, `CREATE`, or superuser. Prisma Migrate should use a separate privileged user. |
| 2.6 | Connection pooling configured                | 📋     | Use PgBouncer or Prisma Accelerate for connection management in production.                                                                             |

## 3. API Trust Boundaries

| #   | Requirement                                      | Status | Evidence                                                                                |
| --- | ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------- |
| 3.1 | All endpoints require `x-api-key` auth           | ✅     | Every route except `/health` and `/synthetic` uses `requireOrg()`.                      |
| 3.2 | Single auth chokepoint (`requireOrg`)            | ✅     | `apps/api/src/utils/auth.ts` — all routes funnel through this.                          |
| 3.3 | Organization ownership enforced on reads         | ✅     | `GET /receipts`, `GET /receipt/:id`, `GET /receipt/:id/pdf` all check `organizationId`. |
| 3.4 | Cross-tenant isolation tested                    | ✅     | `v2-integration.test.ts` — Org B cannot see/access Org A data (403).                    |
| 3.5 | Per-org metering via `RequestLog.organizationId` | ✅     | Verified by test: `RequestLog entries have organizationId populated`.                   |
| 3.6 | Rate limiting enabled                            | ✅     | `@fastify/rate-limit` configured.                                                       |
| 3.7 | Security headers (Helmet)                        | ✅     | `@fastify/helmet` configured.                                                           |
| 3.8 | Request body size limits                         | ✅     | `bodyLimit: 5242880` (5 MB) on `/verify`.                                               |
| 3.9 | Input validation (Zod + JSON Schema)             | ✅     | `verifyRouteSchema` + Zod on ATTOM endpoint.                                            |

## 4. Cryptographic Integrity

| #   | Requirement                                | Status | Evidence                                                 |
| --- | ------------------------------------------ | ------ | -------------------------------------------------------- |
| 4.1 | Keccak-256 for document hashing            | ✅     | `keccak256Buffer` from `@deed-shield/core`.              |
| 4.2 | Receipt hash verification                  | ✅     | `POST /receipt/:id/verify` recomputes hash.              |
| 4.3 | JWT receipts have expiration               | ✅     | Enforced in core receipt builder.                        |
| 4.4 | Private keys never in code or config files | ✅     | Only via `PRIVATE_KEY` env var, never imported directly. |

## 5. Pre-Deployment Verification Commands

```bash
# 1. Verify no secrets in git history
git rev-list --all | xargs -I{} git ls-tree -r {} --name-only | grep -E '\.env$|\.env\.local$|\.sqlite$' | sort -u
# Expected: empty output (or only .env.example / schema.sqlite.sql)

# 2. Run full test suite
cd apps/api && npm test

# 3. Verify DATABASE_URL has TLS
echo $DATABASE_URL | grep -q 'sslmode=' && echo "TLS configured" || echo "WARNING: No sslmode"

# 4. Check npm audit
npm audit --production
```

## 6. Items Requiring Out-of-Repo Action

These cannot be verified in code and require manual confirmation:

- [ ] **Secret rotation**: Rotate all API keys, DB passwords, and wallet private keys that were ever in `.env.local`.
- [ ] **DB encryption at rest**: Confirm with hosting provider.
- [ ] **DB TLS certificate**: Ensure the CA cert is valid and not self-signed for production.
- [ ] **GitHub secret scanning**: Enable in repo settings.
- [ ] **Separate staging/prod credentials**: Create distinct DB users and API keys per environment.
- [ ] **Dependabot vulnerability**: Address the moderate vulnerability at `github.com/chrismaz11/Deed_Shield/security/dependabot/45`.

---

_Last updated: 2026-02-18 by security remediation session._
