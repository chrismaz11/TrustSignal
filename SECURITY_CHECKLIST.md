# Deed Shield — Security & Production Readiness Checklist

> This document tracks the security posture of the Deed Shield API.
> Each item is either ✅ (verified in-repo), 🔒 (enforced by code), or 📋 (requires infra/ops verification).

---

## 1. Secrets & Repository Hygiene

| #   | Requirement                                                       | Status | Evidence                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.1 | No `.env`, `.env.local`, or secret files in git history           | ✅     | `git filter-branch` rewrite on 2026-02-18. Verified via `git rev-list --all \| xargs git ls-tree -r --name-only \| grep .env` returns empty.                                                                 |
| 1.2 | `.gitignore` blocks `.env*`, `*.sqlite`, secret files             | ✅     | See `.gitignore` — covers `**/.env`, `.env.local`, `attestations.sqlite`.                                                                                                                                    |
| 1.3 | `.env.example` provided with placeholder values (no real secrets) | ✅     | `apps/api/.env.example` — contains only empty strings and `localhost` URLs.                                                                                                                                  |
| 1.4 | Developer setup guide documents how to obtain secrets             | ✅     | `apps/api/SETUP.md` — references team leads / secrets manager.                                                                                                                                               |
| 1.5 | GitHub secret scanning enabled                                    | ⚠️     | Requires **GitHub Advanced Security** (public repos or Enterprise plan). Dependabot alerts are enabled. For private repos on free/team plan, use `git-secrets` or `trufflehog` as a pre-commit hook instead. |
| 1.6 | Rotate any secrets that were ever committed                       | 📋     | All API keys, DB passwords, and private keys that existed in `.env.local` or `apps/api/.env` prior to the scrub **must be rotated**. Treat them as compromised.                                              |

## 2. Database Security

| #   | Requirement                                  | Status | Evidence                                                                                                                                                |
| --- | -------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 | Schema uses `postgresql` provider            | ✅     | `apps/api/prisma/schema.prisma` line 6.                                                                                                                 |
| 2.2 | TLS enforced on DB connections in production | 🔒     | `server.ts` startup guard rejects `DATABASE_URL` without `sslmode=require\|verify-full\|verify-ca` when `NODE_ENV=production`.                          |
| 2.3 | Encryption at rest on DB volume              | ✅     | Supabase enforces AES-256 encryption at rest as a platform-level default for all managed PostgreSQL databases. Root-key presence and TLSv1.3 session verified for production. Full evidence bundle stored under `docs/evidence/db-security/` (see `docs/ops/db-security-evidence.md` for index). Provider screenshots and SOC 2 excerpt stored in private compliance repository. |
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

## 5. Dependency Security

| #   | Requirement                | Status | Evidence                                                                                                                 |
| --- | -------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------ |
| 5.1 | `npm audit` clean          | ✅     | 0 vulnerabilities in production and dev dependencies.                                                                    |
| 5.2 | Dependabot alerts enabled  | ✅     | Enabled via GitHub API.                                                                                                  |
| 5.3 | Known alerts triaged       | ✅     | Alert #45 (`ajv` ReDoS) dismissed — dev-only transitive dep of ESLint, production uses patched `ajv@8.18.0` via Fastify. |
| 5.4 | No lint errors in codebase | ✅     | All ESLint errors resolved. Only remaining notice is Prisma v7 migration advisory (informational).                       |

## 6. Pre-Deployment Verification Commands

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

# 5. Capture DB security evidence bundle (staging/prod)
DATABASE_URL="$DATABASE_URL" npm run evidence:db -- --environment staging --db-instance-id <rds-instance-id>
```

## 7. Items Requiring Out-of-Repo Action

These cannot be verified in code and require manual confirmation:

| #   | Action                                | Who   | Notes                                                                                                       |
| --- | ------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------- |
| 7.1 | **Rotate ATTOM_API_KEY**              | Ops   | Was in `.env.local` — generate new key in ATTOM dashboard                                                   |
| 7.2 | **Rotate OPENAI_API_KEY**             | Ops   | Was in `.env.local` — revoke old key in OpenAI dashboard                                                    |
| 7.3 | **Rotate PRIVATE_KEY**                | Ops   | Ethereum wallet key — generate new wallet, transfer any assets, update `PRIVATE_KEY` env var                |
| 7.4 | **Rotate DATABASE_URL**               | Ops   | Change DB password if it was in any committed file                                                          |
| 7.5 | **DB encryption at rest**             | Infra | ✅ Confirmed via Supabase platform default (AES-256). Evidence stored in private compliance storage (bundle “db-security/production-2026-03-23T19:19Z”) and Vanta. Provider screenshots stored in private compliance storage. |
| 7.6 | **DB TLS certificate**                | Infra | Ensure CA cert is valid, not self-signed, for production                                                    |
| 7.7 | **Separate staging/prod credentials** | Ops   | Create distinct DB users and API keys per environment                                                       |
| 7.8 | **Pre-commit secret scanning**        | Dev   | Install `git-secrets` or `trufflehog` as pre-commit hook (since GitHub secret scanning requires Enterprise) |

### 7.A Rotation Evidence And Cadence

Rotation policy:

- rotate exposed or suspected-exposed secrets immediately
- rotate standing secrets at least every 90 days unless a stricter provider or customer obligation applies
- record the operator, timestamp, and validation outcome for every rotation event

Store rotation evidence in:

- Vanta
- private compliance storage
- a private audit repository

Recommended evidence bundle for each rotated secret:

| Secret | Cadence | Evidence Required | Evidence Location |
| --- | --- | --- | --- |
| `ATTOM_API_KEY` | Immediate if exposed, otherwise every 90 days | provider rotation log, redacted screenshot, post-rotation smoke test result | Vanta or private audit repository |
| `OPENAI_API_KEY` | Immediate if exposed, otherwise every 90 days | provider rotation log, redacted screenshot, post-rotation smoke test result | Vanta or private audit repository |
| `PRIVATE_KEY` | Immediate if exposed, otherwise on key-management schedule | key replacement record, redeploy confirmation, receipt verification sample | private audit repository |
| `DATABASE_URL` / DB password | Immediate if exposed, otherwise every 90 days | password rotation record, redeploy confirmation, database connectivity proof | Vanta or private audit repository |

---

_Last updated: 2026-03-23T19:19 UTC by SOC 2 remediation — DB encryption-at-rest evidence (Workstream #3)._
