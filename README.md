# TrustSignal

Universal verification engine with a DeedShield property-record module and a forward path to healthcare credentialing.

## Release Status (Session 7 Final)

- Fastify v5 verification API contract: `/v1/verify-bundle`, `/v1/revoke`, `/v1/status/:bundleId`
- Halo2 circuits (non-membership + revocation): `gate_count=1024`, `k=10`
- ZKML artifact: `ml/zkml/deed_cnn.compiled` + benchmark (`proof_gen_ms=1506.46`, `auc=0.998`)
- JavaScript SDK (`sdk/`): `verify()`, `revoke()`, `status()` with ESM + CJS builds and zero runtime dependencies
- Test and quality posture: 64/64 tests passing, strict TypeScript clean, scoped coverage `99.34%`
- Security posture: OWASP audit + threat model published, JWT rotation support, rate limiting, structured log redaction
- CI posture: GitHub Actions jobs for lint, typecheck, tests+coverage, and Rust build/tests

## Repository Scope

This repository is the main TrustSignal project. It contains:

- Product-facing docs and governance artifacts under `docs/`
- TrustSignal verification runtime under `src/`
- DeedShield API/Web implementation in `apps/`
- Shared verification logic and contract code in `packages/`
- Halo2 and ZKML proof artifacts in `circuits/` and `ml/`

## Quickstart

- All `/api/v1/*` endpoints except `/api/v1/health` require `x-api-key`.
- Configure API keys with `API_KEYS` and optional `API_KEY_SCOPES`.
- CORS is deny-by-default in production unless `CORS_ALLOWLIST` is set.
- In production, startup fails if `NOTARY_API_KEY`, `PROPERTY_API_KEY`, or `TRUST_REGISTRY_SOURCE` are missing.
- Receipt and Vanta responses expose `anchor.subjectDigest` / `anchorSubjectDigest` plus `anchorSubjectVersion` so proof provenance can be audited independently of the raw receipt JSON.
- Revocation requires issuer signature headers:
  - `x-issuer-id`
  - `x-signature-timestamp`
  - `x-issuer-signature` (signature over `revoke:<receiptId>:<timestamp>`)

## Data Minimization Defaults

- Receipts persist `inputsCommitment` and `rawInputsHash` (commitment hash), not full raw input payloads.

## Local Demo

Prerequisites:

- Root workspace: Node 18+ is supported.
- `apps/api` with Prisma 7 and Hardhat 3 is validated on Node 22.

### 2) Configure environment

```bash
cp .env.example .env.local
```

Set real values in `.env.local` for:

- `TRUSTSIGNAL_JWT_SECRETS` (or `TRUSTSIGNAL_JWT_SECRET`)
- `TRUSTSIGNAL_ZKP_BACKEND`
- `TRUSTSIGNAL_ZKP_PROVER_BIN` and `TRUSTSIGNAL_ZKP_VERIFIER_BIN` when `TRUSTSIGNAL_ZKP_BACKEND=external`
  - Current bootstrap prover binary: `circuits/non_mem_gadget/target/release/zkp_service`
- `POLYGON_MUMBAI_RPC_URL`
- `POLYGON_MUMBAI_PRIVATE_KEY`
- `DATABASE_URL` for runtime pooled access
- `DIRECT_URL` for Prisma CLI access (`npm -w apps/api run db:generate`, `db:push`, migrations)
- optional aliases: `SUPABASE_DB_URL` / `SUPABASE_POOLER_URL` for pooled runtime, `SUPABASE_DIRECT_URL` for Prisma CLI, or `SUPABASE_DB_PASSWORD` plus Supabase CLI pooler metadata discovery

Never commit real secrets.

ZKP status note:

- `dev-only` remains the default local mode.
- `external` now supports a real Halo2 proof round-trip through `circuits/non_mem_gadget/src/bin/zkp_service.rs`, but that binary currently proves a bootstrap attestation circuit over public proof inputs, not the final document-hash statement.
- Do not describe the current bootstrap circuit as full document authenticity or PII-preserving document hashing.

Contract note:

- `packages/contracts` uses Hardhat 3 and needs Node 22+ for local compile/smoke runs.

### 3) Run validation gates

```bash
npm run lint
npm run typecheck
npm test
```

### 4) Run DeedShield API/Web (workspace apps)

```bash
npm -w apps/api run db:generate
npm -w apps/api run db:push
npm -w apps/api run dev
```

Notes:

- Prisma 7 in `apps/api` resolves the CLI datasource through `apps/api/prisma.config.ts`.
- Keep the pooled connection in `DATABASE_URL` and the direct Postgres connection in `DIRECT_URL` to avoid migration/provisioning issues on Supabase.

In a second terminal:

```bash
npm -w apps/web run dev
```

## TrustSignal API Contract (`src/routes`)

All TrustSignal `/v1/*` endpoints require `Authorization: Bearer <jwt>`.

- `POST /v1/verify-bundle`
  - Validates request with Zod.
  - Runs non-membership proof, revocation proof, and ZKML verification.
  - Persists result to `VerificationRecord`.
- `POST /v1/revoke`
  - Requires admin JWT claim (`role=admin` or equivalent claim form).
  - Anchors nullifier on Polygon Mumbai and marks record revoked.
- `GET /v1/status/:bundleId`
  - Returns latest persisted verification state for a bundle hash.
- `GET /api/v1/integrations/vanta/schema`
  - Returns JSON Schema for Vanta-ingestable verification payloads.
- `GET /api/v1/integrations/vanta/verification/:receiptId`
  - Returns structured verification evidence payload (`trustsignal.vanta.verification_result.v1`).
- `GET /api/v1/registry/sources`
  - Returns configured primary-source registry adapters (OFAC/OIG/SAM/UK/BIS/CSL/NPPES/SEC/FDIC), freshness metadata, and circuit mapping.
- `POST /api/v1/registry/verify`
  - Runs a source-specific check with cached results and returns normalized match evidence (`MATCH`, `NO_MATCH`, `COMPLIANCE_GAP`).
- `POST /api/v1/registry/verify-batch`
  - Screens one subject across multiple registry sources and returns an aggregate summary including `complianceGapSources`.
- `GET /api/v1/registry/jobs` and `GET /api/v1/registry/jobs/:jobId`
  - Exposes ZK oracle dispatch job state for registry checks (`QUEUED`, `DISPATCHED`, `SKIPPED`, `FAILED`).

Reference implementation: `tests/api/routes.test.ts`.

## Security Defaults

- Input validation at API boundaries (Zod)
- JWT verification with key rotation (`TRUSTSIGNAL_JWT_SECRETS`)
- Rate limiting using `@fastify/rate-limit`
- Structured request logging with authorization redaction
- Fail-closed behavior on proof verification errors
- Production requires an explicit external ZKP backend; the built-in dev attestation path is blocked when `NODE_ENV=production`
- No stack traces or raw internals in API responses
- Primary-source registry guardrails with explicit `COMPLIANCE_GAP` outcomes when authoritative endpoints are unavailable or non-compliant

Detailed reports:

- `security/audit_report.md`
- `security/threat_model.md`

## Data Model

Primary runtime persistence model:

- Prisma `VerificationRecord` (`prisma/schema.prisma`)
  - Bundle hash, proof outcomes, fraud score, proof latency
  - Revocation state, reason, transaction hash, and revocation timestamp

## SDK

The TrustSignal JavaScript SDK is under `sdk/` and exposes:

- `verify(bundle)`
- `revoke(bundleHash, reason)`
- `status(bundleId)`

See `sdk/README.md` for usage examples.

## CI/CD

GitHub Actions workflow: `.github/workflows/ci.yml`

- `lint`
- `typecheck`
- `test` (with coverage)
- `rust-build` (Halo2 crate build + tests)

## Vercel Deployment

- API serverless entrypoint: `apps/api/api/[...path].ts`
- Root deployment policy config: `vercel.json`
- API-specific Vercel config (if deploying `apps/api` as project root): `apps/api/vercel.json`
- Root `vercel.json` currently rewrites `/api/*` traffic to the API serverless entrypoint.

For production, deploy with environment variables managed in Vercel project settings (never in repo files).

## Canonical Documentation

- `docs/README.md`
- `docs/final/01_EXECUTIVE_SUMMARY.md`
- `docs/final/11_NSF_GRANT_WHITEPAPER.md`
- `docs/final/12_R_AND_D_LOG.md`
- `docs/final/13_SOC2_READINESS_KICKOFF.md`
- `docs/final/14_VANTA_INTEGRATION_USE_CASE.md`
- `TASKS.md`
- `CHANGELOG.md`

## Compliance and Claims Boundaries

- TrustSignal provides technical verification signals, not legal determinations.
- Avoid PII in logs and artifacts.
- Do not represent HIPAA or equivalent compliance unless infra and controls are independently validated.
