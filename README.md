# TrustSignal

[![CI](https://img.shields.io/github/actions/workflow/status/trustsignal-dev/trustsignal/ci.yml?branch=master&label=CI)](https://github.com/trustsignal-dev/trustsignal/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-threshold%2090%25-0A7F5A)](vitest.config.ts)
[![Security Checklist](https://img.shields.io/badge/security-checklist-informational)](SECURITY_CHECKLIST.md)

Website: https://trustsignal.dev

TrustSignal is evidence-integrity infrastructure that operates as an integrity layer for existing workflows. It issues **signed verification receipts**, verification signals, and verifiable provenance metadata — enabling **later verification** and auditability without replacing the upstream system of record. TrustSignal’s public integration boundary intentionally avoids exposing signing internals or proof internals and focuses on returning durable verification artifacts that integrators can store alongside their own evidence.

## Problem

High-stakes document and evidence workflows create an attack surface after collection, not just at intake. Once an artifact has been uploaded, reviewed, or approved, downstream teams still face risks such as tampered evidence, provenance loss, artifact substitution, and stale evidence that can no longer be verified later.

Those risks matter in audit, compliance, partner-review, and trust-sensitive workflows because the evidence is often challenged after collection rather than at the moment it first entered the system. TrustSignal is designed for workflows where later auditability matters because the artifact, its provenance, or the surrounding workflow record may be questioned later.

## Verification Lifecycle

The canonical lifecycle diagram and trust-boundary view are documented in [docs/verification-lifecycle.md](docs/verification-lifecycle.md).

TrustSignal accepts a verification request, returns verification signals, issues a signed verification receipt, and supports later verification against stored receipt state so downstream teams can detect artifact tampering, evidence provenance loss, or stale records during audit review.

## Demo

The fastest evaluator path is the local 5-minute developer trial:

TrustSignal provides:

- signed verification receipts
- verification signals
- verifiable provenance metadata
- later verification capability
- existing workflow integration through the public API boundary

```bash
npm install
npm run demo
```

It shows the full lifecycle in one run:

1. artifact intake
2. verification result
3. signed receipt issuance
4. later verification
5. tampered artifact mismatch detection

See [demo/README.md](demo/README.md).

## Integration Model

Start here if you are evaluating the public verification lifecycle:

- [Evaluator quickstart](docs/partner-eval/quickstart.md)
- [API playground](docs/partner-eval/api-playground.md)
- [OpenAPI contract](openapi.yaml)
- [Postman collection](postman/TrustSignal.postman_collection.json)
- [Postman local environment](postman/TrustSignal.local.postman_environment.json)

Golden path:

1. submit a verification request
2. receive verification signals plus a signed verification receipt
3. retrieve the stored receipt
4. run later verification

## Technical Details

The fastest path in this repository is the public `/api/v1/*` evaluator flow. It is a deliberate evaluator path, not a shortcut around production controls.

The current partner-facing lifecycle in this repository is:

- `POST /api/v1/clients`
- `POST /api/v1/auth/register`
- `GET /api/v1/auth/login`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/oauth/authorize`
- `POST /api/v1/oauth/authorize/consent`
- `GET /api/v1/clients/:clientId/keys`
- `POST /api/v1/clients/:clientId/keys`
- `DELETE /api/v1/clients/:clientId/keys/:kid`
- `POST /api/v1/clients/:clientId/revoke`
- `POST /api/v1/token`
- `POST /api/v1/introspect`
- `POST /api/v1/verify`
- `GET /api/v1/receipt/:receiptId`
- `GET /api/v1/receipt/:receiptId/pdf`
- `POST /api/v1/receipt/:receiptId/verify`
- `POST /api/v1/receipt/:receiptId/revoke`
- `POST /api/v1/anchor/:receiptId`
- `GET /api/v1/receipts`

## What You Will See

The evaluator path is designed to show the core value before full production integration work:

- artifact intake through the public API
- signed verification receipt issuance
- verification signals that can be stored in an existing workflow
- later verification against the stored receipt state
- visible handling for tampered evidence or stale evidence through the later verification lifecycle

## Local API Development Setup

Prerequisites:

- Node.js `>= 18`
- npm `>= 9`
- PostgreSQL `>= 14` for `apps/api`

Minimal setup:

```bash
npm install
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env
npm -w apps/api run db:generate
npm -w apps/api run db:push
npm -w apps/api run dev
```

In a second terminal:

```bash
npm -w apps/web run dev
```

Default local ports:

- web app: `http://localhost:3000`
- API: `http://localhost:3001`

## Run The API Evaluation Flow

Once the local API is running, use the evaluator quickstart or the public examples directly:

Preferred machine flow:

1. register a client with a public JWK at `POST /api/v1/clients`
2. rotate local public keys with `POST /api/v1/clients/:clientId/keys` and `DELETE /api/v1/clients/:clientId/keys/:kid` as needed
3. exchange a signed `private_key_jwt` assertion at `POST /api/v1/token`
4. optionally introspect or self-revoke machine clients with `POST /api/v1/introspect` and `POST /api/v1/clients/:clientId/revoke`
5. call the verification API with `Authorization: Bearer $TRUSTSIGNAL_ACCESS_TOKEN`

Set `TRUSTSIGNAL_REPLAY_REDIS_URL` in multi-instance deployments so assertion replay protection is shared across API nodes. Without Redis, replay protection falls back to the database nonce table.

Legacy `x-api-key` auth is still accepted during the migration window.

Preferred browser OAuth flow:

1. create a user with `POST /api/v1/auth/register`
2. sign in through `GET /api/v1/auth/login` or `POST /api/v1/auth/login`
3. register a browser client with `POST /api/v1/clients` using `clientType: browser` and exact `redirectUris`
4. start Authorization Code + PKCE with `GET /api/v1/oauth/authorize`
5. approve consent at `POST /api/v1/oauth/authorize/consent`
6. exchange the one-time code at `POST /api/v1/token` with `grant_type=authorization_code`
7. call protected API routes with the delegated bearer token

```bash
curl -X POST "http://localhost:3001/api/v1/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TRUSTSIGNAL_ACCESS_TOKEN" \
  --data @examples/verification-request.json
```

Then retrieve the stored receipt and run later verification:

```bash
curl "http://localhost:3001/api/v1/receipt/$RECEIPT_ID" \
  -H "Authorization: Bearer $TRUSTSIGNAL_ACCESS_TOKEN"

curl -X POST "http://localhost:3001/api/v1/receipt/$RECEIPT_ID/verify" \
  -H "Authorization: Bearer $TRUSTSIGNAL_ACCESS_TOKEN"
```

## What The Developer Trial Proves

The evaluator flow demonstrates that:

- TrustSignal can fit behind an existing workflow without replacing the system of record
- the API returns signed verification receipts and verification signals in one flow
- later verification is explicit and separate from initial receipt issuance
- the system is built for attack surfaces such as tampered evidence, provenance loss, and artifact substitution in later review paths

## Integration Fit

TrustSignal is designed to sit behind an existing workflow such as:

- a compliance evidence pipeline
- a partner portal
- an intake or case-management system
- a deed or property-record workflow

The upstream platform remains the system of record. TrustSignal adds an integrity layer at the boundary and returns technical verification artifacts that the upstream workflow can store and use later.

## Integration Boundary Notes

The local evaluator path is intentionally constrained. Local development defaults are a deliberate evaluator and development path, and they fail closed where production trust assumptions are not satisfied.

Authentication prefers short-lived bearer access tokens minted from registered client keys at `POST /api/v1/token`. Legacy scoped `x-api-key` auth remains available during the migration. Revocation additionally requires issuer authorization headers: `x-issuer-id`, `x-signature-timestamp`, and `x-issuer-signature`.

Browser Authorization Code + PKCE is implemented in this repository through `/api/v1/auth/*`, `/api/v1/oauth/authorize`, `/api/v1/oauth/authorize/consent`, and the shared `POST /api/v1/token` endpoint. Browser clients are stored as `clientType: browser`, must register exact redirect URIs, and require PKCE `S256`. The same bearer-token validation path is reused for both browser and machine access tokens, while M2M `private_key_jwt` remains intact.

The repository also still includes a legacy JWT-authenticated `/v1/*` surface used by the current JavaScript SDK:

- `POST /v1/verify-bundle`
- `GET /v1/status/:bundleId`
- `POST /v1/revoke`

## Production Deployment Requirements

Production deployment requires explicit authentication, signing configuration, and environment setup. Public documentation should be read as architecturally mature and bounded, not as a claim that every deployment control is satisfied automatically.

For production use, plan for at least:

- explicit machine-client registration and access-token signing configuration
- signing configuration and key management through environment setup
- receipt lifecycle checks before downstream reliance
- database and network security controls appropriate for the deployment environment
- environment-specific operational controls outside this repository

Fail-closed defaults are part of the security posture. They are meant to prevent the system from silently assuming production trust conditions that have not been configured.

## Public API Contract And Examples

The public evaluation artifacts in this repo are:

- [openapi.yaml](openapi.yaml)
- [verification-request.json](examples/verification-request.json)
- [verification-response.json](examples/verification-response.json)
- [verification-receipt.json](examples/verification-receipt.json)
- [verification-status.json](examples/verification-status.json)
- [partner evaluation kit](docs/partner-eval/overview.md)

These artifacts document the public verification lifecycle only. They intentionally avoid proof internals, model outputs, circuit identifiers, signing infrastructure specifics, and internal service topology.

## Security Posture

Public-facing security properties for this repository are:

- scoped API authentication for the integration-facing API
- browser Authorization Code + PKCE with exact redirect URI matching and consent persistence
- request validation and rate limiting at the gateway
- signed verification receipts returned with verification responses
- later verification of stored receipt integrity and status
- explicit lifecycle boundaries for read, revoke, and provenance-state operations
- fail-closed defaults where production trust assumptions are not satisfied

See [docs/security-summary.md](docs/security-summary.md), [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md), and [docs/SECURITY.md](docs/SECURITY.md) for the current public-safe security summary and repository guardrails.

## What TrustSignal Does Not Claim

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- a replacement for the system of record
- infrastructure claims that depend on environment-specific evidence outside this repository

## Current Repository Context

TrustSignal is the canonical product and application surface in this repository. The current wedge remains property-record verification, with the platform framed as evidence integrity infrastructure for existing workflows.

## Newbie Difficulty Rating

**Overall: 7 / 10** — This is a production-grade, security-critical codebase. It requires familiarity with multiple technologies and concepts. Newcomers with a general web-development background can follow the evaluator path and run the demo within minutes, but full contribution requires deeper expertise across several layers.

| Area | Difficulty | Notes |
|------|-----------|-------|
| Running the demo | 2 / 10 | `npm install && npm run demo` is all you need |
| API integration | 3 / 10 | Well-documented OpenAPI spec and Postman collections |
| Web app (Next.js) | 4 / 10 | Standard React and Next.js patterns |
| API server (Fastify) | 5 / 10 | Requires Node.js and TypeScript familiarity |
| Verification core | 6 / 10 | Cryptographic hashing and JWS signing knowledge needed |
| Smart contracts | 8 / 10 | Requires Solidity and Hardhat experience |
| ZKP circuits | 9 / 10 | Requires Rust and Halo2 zero-knowledge proof expertise |

### Recommended Starting Points by Background

- **Evaluator / non-engineer** — Run `npm run demo` and read [docs/partner-eval/start-here.md](docs/partner-eval/start-here.md)
- **Junior developer** — Follow the local setup in this README, then explore `apps/api`
- **Full-stack developer** — Dive into `apps/api` and `packages/core`
- **Blockchain engineer** — Explore `packages/contracts` and the anchoring lifecycle
- **Cryptography / ZKP engineer** — Explore `circuits/`

## Validation

Relevant repository checks include:

```bash
npm run messaging:check
npm run typecheck
npm run build
```

## Documentation Map

- [docs/partner-eval/overview.md](docs/partner-eval/overview.md)
- [docs/partner-eval/quickstart.md](docs/partner-eval/quickstart.md)
- [docs/partner-eval/api-playground.md](docs/partner-eval/api-playground.md)
- [wiki/What-is-TrustSignal.md](wiki/What-is-TrustSignal.md)
- [wiki/API-Overview.md](wiki/API-Overview.md)
- [wiki/Claims-Boundary.md](wiki/Claims-Boundary.md)
- [wiki/Verification-Receipts.md](wiki/Verification-Receipts.md)
