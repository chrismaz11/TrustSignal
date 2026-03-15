# Changelog

All notable changes to TrustSignal are documented in this file.

The format is based on Keep a Changelog and this project follows Semantic Versioning principles for externally visible contract changes.

## 0.1.0 - 2026-03-02

### Added

- Fastify v5 TrustSignal verification contract under `src/routes`:
  - `POST /v1/verify-bundle`
  - `POST /v1/revoke`
  - `GET /v1/status/:bundleId`
- Halo2 non-membership + revocation verification integration (`circuits/non_mem_gadget`, `src/verifiers/halo2Bridge.ts`).
- ZKML verification integration with benchmark artifacts (`ml/zkml/`, `src/verifiers/zkmlVerifier.ts`).
- Prisma `VerificationRecord` persistence model for verification and revocation lifecycle (`prisma/schema.prisma`).
- JavaScript SDK in `sdk/` exposing `verify()`, `revoke()`, and `status()` with ESM/CJS builds.
- Security audit and threat model deliverables:
  - `security/audit_report.md`
  - `security/threat_model.md`
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) with lint, strict typecheck, tests+coverage, and Rust build/tests.
- Session 7 final documentation set:
  - Root developer README (`README.md`)
  - NSF/grant-ready whitepaper (`docs/final/11_NSF_GRANT_WHITEPAPER.md`)
  - Canonical R&D log (`docs/final/12_R_AND_D_LOG.md`)
  - Root Vercel deployment policy (`vercel.json`)

### Changed

- Repositioned repository documentation from TrustSignal-only framing to TrustSignal canonical platform framing.
- Standardized production-readiness narrative across `docs/final`, `TASKS.md`, and release artifacts.

### Security

- Added JWT key rotation support (`TRUSTSIGNAL_JWT_SECRETS`) with legacy fallback (`TRUSTSIGNAL_JWT_SECRET`).
- Added structured request logging with authorization redaction.
- Added API rate-limiting middleware via `@fastify/rate-limit`.
- Added explicit, sanitized error handling on verification/revocation/status routes.

### Quality

- Test baseline: 64/64 passing.
- Coverage baseline: 99.34% lines/statements (100% functions).
- Strict TypeScript checks passing in CI.
