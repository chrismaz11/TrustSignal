# Remediation Log - Deed Shield Pilot Readiness

## 1. Trust Registry Security (Critical)

- **Issue**: Trust registry validation relied on a public key stored on disk next to the registry file, allowing trivial replacement attacks.
- **Fix**: Updated `registryLoader.ts` to prioritize `TRUST_REGISTRY_PUBLIC_KEY` environment variable.
- **Enforcement**: In `production`, the application now THROWS a critical error if this environment variable is missing.

## 2. JWT Security (Critical)

- **Issue**: Receipt JWTs were signed without an expiration claim (`exp`), allowing indefinite replay.
- **Fix**: Added `.setExpirationTime('30d')` to the JWT signing process in `packages/core/src/receipt.ts`.

## 3. API Surface Hardening (Blocker)

- **Issue**: Missing rate limiting, security headers, and strict input validation.
- **Fix**:
  - Added `@fastify/rate-limit` (100 req/min).
  - Added `@fastify/helmet` for security headers.
  - Implemented Strict JSON Schema for `POST /api/v1/verify` with `additionalProperties: false`.
  - Enforced `bodyLimit: 5MB`.

## 4. AI Compliance Reliability (High)

- **Issue**: `CookCountyComplianceValidator` had undefined behavior on upstream failure/timeout.
- **Fix**:
  - Added 15s timeout to OpenAI calls.
  - Implemented Circuit Breaker pattern: Failures now return `FLAGGED` (Warning) with "Service Unavailable" details instead of crashing or returning `FAIL` (Blocking). This ensures operations continue in a "Fail-to-Manual" mode.

## Next Steps

- **Infrastructure**: Configure AWS Secrets Manager to populate `TRUST_REGISTRY_PUBLIC_KEY`, `ATTOM_API_KEY`, etc.
- **Database**: Wire up `DuplicatePropertyVerifier` in `verifyBundle` to enforce duplicate checks.
- **TLS**: Ensure load balancer terminates TLS 1.3.

## 5. Auth, Ownership & Audit (Critical)

- **Issue**: Lack of authentication on revocation/anchoring; Missing immutable audit trail; Legacy insecure code.
- **Fix**:
  - Implemented `Revocation` and `VerificationEvent` immutable tables in Prisma.
  - Enforced `x-api-key` and `Organization` ownership on `/verify`, `/revoke`, and `/anchor`.
  - Removed legacy `src/api/verify.js`.
  - Updated `Authorization` checks to strictly forbid cross-organization actions.
- **Verification**: `npm test` passes with authenticated flows.

## 6. Dependencies & Infrastructure (Compliance)

- **Issue**: Missing license, stale lockfile, potential vulnerabilities.
- **Fix**:
  - Added `license: "UNLICENSED"` to `package.json` to signal proprietary status.
  - Ran `npm audit` and fixed high-severity vulnerabilities (e.g., Axios).
  - Verified `src/config/secrets.ts` correctly falls back to AWS Secrets Manager.
  - Re-generated `package-lock.json` for deterministic builds.
