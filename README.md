# TrustSignal

[![CI](https://img.shields.io/github/actions/workflow/status/trustsignal-dev/trustsignal/ci.yml?branch=master&label=CI)](https://github.com/trustsignal-dev/trustsignal/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-supported-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Coverage](https://img.shields.io/badge/coverage-threshold%2090%25-0A7F5A)](vitest.config.ts)
[![Security Checklist](https://img.shields.io/badge/security-checklist-informational)](SECURITY_CHECKLIST.md)

Website: https://trustsignal.dev

TrustSignal is evidence integrity infrastructure for existing workflows. It acts as an integrity layer that returns signed verification receipts, verification signals, verifiable provenance metadata, and later verification capability without replacing the upstream system of record.

## Problem

Many teams can show that a file was uploaded, reviewed, or approved. Fewer can later verify that the same artifact is still the one tied to the decision they recorded.

That gap creates audit friction, partner review friction, and avoidable evidence disputes. Workflow systems remain important, but they often need a durable verification artifact that can be retrieved and checked later.

## Integrity Model

TrustSignal addresses that gap by accepting a verification request, evaluating it against configured checks, and issuing a signed verification receipt. The receipt gives downstream systems a stable handle for later verification, receipt retrieval, lifecycle checks, and verifiable provenance.

TrustSignal provides:

- signed verification receipts
- verification signals
- verifiable provenance metadata
- later verification capability
- existing workflow integration through the public API boundary

## Integration Fit

TrustSignal is designed to sit behind an existing workflow such as:

- a compliance evidence pipeline
- a partner portal
- an intake or case-management system
- a deed or property-record workflow

The upstream platform remains the system of record. TrustSignal adds an integrity layer at the boundary and returns technical verification artifacts that the upstream workflow can store and use later.

## Technical Detail

The current partner-facing lifecycle in this repository is the `/api/v1/*` surface:

- `POST /api/v1/verify`
- `GET /api/v1/receipt/:receiptId`
- `GET /api/v1/receipt/:receiptId/pdf`
- `POST /api/v1/receipt/:receiptId/verify`
- `POST /api/v1/receipt/:receiptId/revoke`
- `POST /api/v1/anchor/:receiptId`
- `GET /api/v1/receipts`

Authentication is `x-api-key` with scoped access. Revocation additionally requires issuer authorization headers: `x-issuer-id`, `x-signature-timestamp`, and `x-issuer-signature`.

The repository also still includes a legacy JWT-authenticated `/v1/*` surface used by the current JavaScript SDK:

- `POST /v1/verify-bundle`
- `GET /v1/status/:bundleId`
- `POST /v1/revoke`

## Evaluate The API

Start here if you are evaluating the public verification lifecycle:

- [Evaluator quickstart](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [API playground](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [OpenAPI contract](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [Postman collection](/Users/christopher/Projects/trustsignal/postman/TrustSignal.postman_collection.json)
- [Postman local environment](/Users/christopher/Projects/trustsignal/postman/TrustSignal.local.postman_environment.json)

Golden path:

1. submit a verification request
2. receive verification signals plus a signed verification receipt
3. retrieve the stored receipt
4. run later verification

## Public API Contract And Examples

The public evaluation artifacts added in this repo are:

- [openapi.yaml](/Users/christopher/Projects/trustsignal/openapi.yaml)
- [verification-request.json](/Users/christopher/Projects/trustsignal/examples/verification-request.json)
- [verification-response.json](/Users/christopher/Projects/trustsignal/examples/verification-response.json)
- [verification-receipt.json](/Users/christopher/Projects/trustsignal/examples/verification-receipt.json)
- [verification-status.json](/Users/christopher/Projects/trustsignal/examples/verification-status.json)
- [partner evaluation kit](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)

These artifacts document the public verification lifecycle only. They intentionally avoid proof internals, model outputs, circuit identifiers, signing infrastructure specifics, and internal service topology.

## Security Posture

Public-facing security properties for this repository are:

- scoped API authentication for the integration-facing API
- request validation and rate limiting at the gateway
- signed verification receipts returned with verification responses
- later verification of stored receipt integrity and status
- explicit lifecycle boundaries for read, revoke, and provenance-state operations

See [docs/security-summary.md](/Users/christopher/Projects/trustsignal/docs/security-summary.md), [SECURITY_CHECKLIST.md](/Users/christopher/Projects/trustsignal/SECURITY_CHECKLIST.md), and [docs/SECURITY.md](/Users/christopher/Projects/trustsignal/docs/SECURITY.md) for the current public-safe security summary and repository guardrails.

## What TrustSignal Does Not Claim

TrustSignal does not provide:

- legal determinations
- compliance certification
- fraud adjudication
- a replacement for the system of record
- infrastructure claims that depend on environment-specific evidence outside this repository

## Current Repository Context

DeedShield is the current application surface in this repository. The broader product framing remains TrustSignal as evidence integrity infrastructure and an integrity layer for existing workflows.

## Local Development

Prerequisites:

- Node.js `>= 18`
- npm `>= 9`
- PostgreSQL `>= 14` for `apps/api`

Quickstart:

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

## Validation

Relevant repository checks include:

```bash
npm run messaging:check
npm run typecheck
npm run build
```

## Documentation Map

- [docs/partner-eval/overview.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/overview.md)
- [docs/partner-eval/quickstart.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/quickstart.md)
- [docs/partner-eval/api-playground.md](/Users/christopher/Projects/trustsignal/docs/partner-eval/api-playground.md)
- [wiki/What-is-TrustSignal.md](/Users/christopher/Projects/trustsignal/wiki/What-is-TrustSignal.md)
- [wiki/API-Overview.md](/Users/christopher/Projects/trustsignal/wiki/API-Overview.md)
- [wiki/Claims-Boundary.md](/Users/christopher/Projects/trustsignal/wiki/Claims-Boundary.md)
- [wiki/Verification-Receipts.md](/Users/christopher/Projects/trustsignal/wiki/Verification-Receipts.md)
