# TrustSignal

[![CI](https://img.shields.io/github/actions/workflow/status/trustsignal-dev/trustsignal/ci.yml?branch=master&label=CI)](https://github.com/trustsignal-dev/trustsignal/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-proprietary-lightgrey)](LICENSE)

**Evidence integrity infrastructure for compliance and audit workflows.**

TrustSignal issues signed verification receipts so organizations can prove when evidence was created, where it came from, and whether it has changed — without replacing the system of record.

→ [trustsignal.dev](https://trustsignal.dev) · [Documentation](https://trustsignal.dev/docs) · [Request a Pilot](https://trustsignal.dev/#pilot-request)

---

## The Problem

High-stakes evidence workflows are vulnerable *after* collection, not just at intake. Once an artifact is uploaded, reviewed, or approved, downstream teams face:

- **Tampered evidence** — files altered after the initial handoff
- **Provenance loss** — no durable record of source, control context, or capture time
- **Artifact substitution** — a different file passed off as the original
- **Stale evidence** — records that can no longer be verified when challenged

TrustSignal addresses these risks at the API boundary so the upstream system of record stays untouched.

---

## How It Works

```
Submit artifact → Receive signed receipt → Store alongside evidence → Verify later
```

1. **Intake** — Submit a verification request with an artifact hash, source, and control context
2. **Receipt issuance** — TrustSignal returns a signed verification receipt with provenance metadata
3. **Storage** — Store the receipt in your existing system of record
4. **Later verification** — Compare the current artifact against the original receipt to detect drift or tampering

### Public API Surface

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/verify` | Submit a verification request |
| `GET /api/v1/receipt/:receiptId` | Retrieve a stored receipt |
| `GET /api/v1/receipt/:receiptId/pdf` | Download receipt as PDF |
| `POST /api/v1/receipt/:receiptId/verify` | Later verification against stored state |
| `POST /api/v1/receipt/:receiptId/revoke` | Revoke a receipt |
| `POST /api/v1/anchor/:receiptId` | Anchor receipt on-chain |
| `GET /api/v1/receipts` | List receipts |

---

## Quick Start

### 5-Minute Demo

```bash
npm install
npm run demo
```

The demo runs the full lifecycle: artifact intake → verification → signed receipt → later verification → tampered artifact mismatch detection.

### Local API Development

Prerequisites: Node.js ≥ 18, npm ≥ 9, PostgreSQL ≥ 14

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
cp apps/api/.env.example apps/api/.env

# Set up database
npm -w apps/api run db:generate
npm -w apps/api run db:push

# Start API server (port 3001)
npm -w apps/api run dev

# In a second terminal — start web app (port 3000)
npm -w apps/web run dev
```

### Run a Verification

```bash
# Submit a verification request
curl -X POST "http://localhost:3001/api/v1/verify" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY" \
  --data @examples/verification-request.json

# Retrieve the receipt
curl "http://localhost:3001/api/v1/receipt/$RECEIPT_ID" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"

# Later verification
curl -X POST "http://localhost:3001/api/v1/receipt/$RECEIPT_ID/verify" \
  -H "x-api-key: $TRUSTSIGNAL_API_KEY"
```

---

## Repository Structure

```
apps/
├── api/            Fastify v5 API server (Prisma ORM, PostgreSQL)
└── web/            Next.js web application
packages/
├── core/           Verification engine, receipt signing, provenance
└── contracts/      Solidity smart contracts (Polygon, Hardhat)
circuits/           Halo2 zero-knowledge proof circuits (Rust)
demo/               Interactive evaluator demo
docs/               Architecture, security, partner-eval guides
examples/           Sample request/response payloads
openapi.yaml        Public API contract
postman/            Postman collection and environments
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| API Server | TypeScript, Fastify v5, Prisma ORM |
| Database | PostgreSQL |
| Cryptography | JWS signing, SHA-256 hashing, Halo2 ZKP circuits |
| Blockchain | Solidity, Hardhat, Polygon (EVM-anchored proofs) |
| Web App | Next.js, React |
| ML | ezkl (ZKML) for verifiable anomaly detection |

---

## Integration Fit

TrustSignal sits behind existing workflows — compliance evidence pipelines, partner portals, intake systems, and document workflows. The upstream platform stays the system of record. TrustSignal adds an integrity layer at the boundary.

| Layer | What Stays in Place |
|---|---|
| Evidence collection | Your platform (Vanta, Drata, internal collector) |
| System of record | Unchanged |
| Review workflow | Existing compliance or audit process |
| **TrustSignal** | **Attests at ingestion. Signed receipt travels with artifact.** |

---

## Authentication

- **API key** — Scoped access via `x-api-key` header
- **Revocation** — Requires additional issuer authorization: `x-issuer-id`, `x-signature-timestamp`, `x-issuer-signature`

---

## Validation

```bash
npm run typecheck
npm run build
npm run test
npm run lint
```

---

## Documentation

| Resource | Path |
|---|---|
| Partner Evaluation Kit | [docs/partner-eval/overview.md](docs/partner-eval/overview.md) |
| Evaluator Quickstart | [docs/partner-eval/quickstart.md](docs/partner-eval/quickstart.md) |
| API Playground | [docs/partner-eval/api-playground.md](docs/partner-eval/api-playground.md) |
| Verification Lifecycle | [docs/verification-lifecycle.md](docs/verification-lifecycle.md) |
| Security Summary | [docs/security-summary.md](docs/security-summary.md) |
| Security Checklist | [SECURITY_CHECKLIST.md](SECURITY_CHECKLIST.md) |
| OpenAPI Contract | [openapi.yaml](openapi.yaml) |

---

## Security

- Scoped API authentication
- Request validation and rate limiting
- Signed verification receipts
- Fail-closed defaults where production trust assumptions are not satisfied
- Explicit lifecycle boundaries for read, revoke, and provenance-state operations

To report a vulnerability: [info@trustsignal.dev](mailto:info@trustsignal.dev)

---

## Claims Boundary

**TrustSignal provides:** Signed verification receipts · Verification signals · Verifiable provenance metadata · Later integrity-check capability

**TrustSignal does not provide:** Legal determinations · Compliance certification · Fraud adjudication · Replacement for the system of record

---

## Ecosystem

| Repository | Purpose |
|---|---|
| [v0-signal-new](https://github.com/TrustSignal-dev/v0-signal-new) | Public website — trustsignal.dev |
| [TrustSignal-App](https://github.com/TrustSignal-dev/TrustSignal-App) | GitHub App for CI verification |
| [TrustSignal-Verify-Artifact](https://github.com/TrustSignal-dev/TrustSignal-Verify-Artifact) | GitHub Action for artifact verification |
| [TrustSignal-Reddit](https://github.com/TrustSignal-dev/TrustSignal-Reddit) | Reddit trust and moderation toolkit |
| [trustagents](https://github.com/TrustSignal-dev/trustagents) | Defensive-security R&D for compliance evidence |
| [TrustSignal-docs](https://github.com/TrustSignal-dev/TrustSignal-docs) | Public documentation |

---

## Contact

[trustsignal.dev](https://trustsignal.dev) · [info@trustsignal.dev](mailto:info@trustsignal.dev) · [Request a Pilot](https://trustsignal.dev/#pilot-request)
