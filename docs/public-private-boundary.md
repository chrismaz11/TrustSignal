# Public / Private Boundary

This codebase is organized to make it straightforward to operate a **public integration layer** and a **private verification engine** with a narrow engine interface.

## Public integration layer
The public integration layer contains API, SDK, public docs, and public route/middleware code. It is responsible for:
- Authentication and authorization
- Request validation and tenant scoping
- Rate limiting and exposure controls
- Response shaping and partner-facing contracts

Public code must not import or orchestrate engine-private helpers or signing internals.

## Private verification engine
The private verification engine owns proof orchestration, signing internals, revocation/anchoring workflows, ZKP/circuits, and compliance evaluation. Engine code is intentionally internal; integrators should depend on the API contract and receipt model rather than internal implementation details.

## Guardrails
- Route handlers must call the narrow engine interface and must not import engine internals directly.
- Public gateway code uses import restrictions and checks (e.g., `npm run check:api-boundary`) to prevent accidental leakage of private engine code.

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
