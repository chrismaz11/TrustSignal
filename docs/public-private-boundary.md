# Public / Private Boundary

This repository is currently a single codebase, but it is being organized so a
future split into:

- a public integration-layer repository
- a private verification-engine repository or service

is straightforward.

## Public-Oriented Surfaces

These directories are intended to remain part of the public integration layer:

- `api/`
- `sdk/`
- `docs/`
- `security/`
- `apps/web/`
- `apps/watcher/`
- `packages/public-contracts/`
- public-facing route, middleware, and response-mapping code in `apps/api/src/`

Public code should own:

- authentication and authorization
- request validation
- tenant scoping
- rate limiting
- idempotency and request lifecycle concerns
- response shaping and partner-facing contracts

## Private Engine Candidates

These areas are intended to move behind a private engine boundary:

- `circuits/`
- `ml/`
- proof orchestration
- risk and scoring logic
- compliance evaluation
- receipt construction and signing internals
- revocation and anchoring workflows
- oracle dispatch and registry decisioning
- `packages/engine-internal/`

## Current Boundary

For this phase:

- `packages/public-contracts/` contains the public contract surface
- `packages/engine-internal/` is the internal boundary package for engine logic
- `packages/core/` remains as a compatibility package, but its root export
  surface is public-only
- `apps/api/src/server.ts` acts as the public gateway and calls a narrow local
  engine interface in `apps/api/src/engine/`
- engine-owned API modules now live under:
  - `apps/api/src/engine/registry/`
  - `apps/api/src/engine/compliance/`
  - `apps/api/src/engine/anchoring/`
- legacy paths under `apps/api/src/services/` and `apps/api/src/anchor.ts`
  remain as compatibility shims only

## Engine Interface

The local engine boundary is intentionally narrow:

- `createVerification(...)`
- `listRegistrySources(...)`
- `verifyRegistrySource(...)`
- `verifyRegistrySources(...)`
- `listRegistryOracleJobs(...)`
- `getRegistryOracleJob(...)`
- `getReceipt(...)`
- `getVerificationStatus(...)`
- `getVantaVerificationResult(...)`
- `crossCheckAttom(...)`
- `anchorReceipt(...)`
- `revokeReceipt(...)`

Route handlers should not directly orchestrate proof generation, risk scoring,
compliance evaluation, receipt signing, or anchoring.

## Guardrails

- public gateway files use ESLint import restrictions to block direct imports of
  engine-private helpers
- `npm run check:api-boundary` scans public API entrypoints for imports from
  engine-private paths, legacy verifier paths, and `packages/core` internals
