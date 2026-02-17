# Deed Shield

Impeccable MVP for a pre-recording verification simulator that ingests synthetic notarized bundles, verifies a simulated RON seal and notary authority, emits immutable-style receipts, and anchors receipt hashes on EVM.

## The Security Gap: Why Deed Shield?

County Recorders are legally restricted to a "ministerial" role. They must record any document that meets basic formatting requirements (margins, notary stamp, fee payment), even if the content is blatantly fraudulent. They have no statutory authority to verify the identity of the signers, the validity of the notary, or the legitimacy of the transaction.

**Deed Shield fills this critical gap** by acting as a pre-recording forensic layer. It:

1.  **Validates Identity & Integrity**: Ensures the notary is active and the digital seal is authentic.
2.  **Analyzes Fraud Risk**: Uses AI to detect anomalies in the document structure and metadata.
3.  **Anchors Truth**: Creates an immutable audit trail on the blockchain, proving exactly what was verified and when.

This protects homeowners from title theft and empowers County Recorders with a "Risk Score" to flag suspicious filings before they become permanent public records.

## Quickstart

```bash
npm install
npm -w apps/api run db:generate
npm -w apps/api run db:push
npm -w apps/api run dev
```

In another terminal:

```bash
npm -w apps/web run dev
```

API defaults to `http://localhost:3001`, web runs on `http://localhost:3000`.

## Local Demo

Runs 50 synthetic verifications, anchors 5 receipts, and verifies receipt integrity.

```bash
npm run demo
```

## Anchoring Modes

- **Local mode (default)**
  - Requires a local EVM RPC at `LOCAL_CHAIN_URL` (defaults to `http://127.0.0.1:8545`).
  - Requires `LOCAL_PRIVATE_KEY` (demo sets it automatically).
- **Sepolia mode**
  - Set `SEPOLIA_RPC_URL` and `PRIVATE_KEY`.
  - Provide `ANCHOR_REGISTRY_ADDRESS` (deployed contract address).

If Sepolia env vars are missing, the API uses local mode.

## API Examples

```bash
curl -s http://localhost:3001/api/v1/health
```

```bash
curl -s http://localhost:3001/api/v1/synthetic | \
  curl -s -X POST http://localhost:3001/api/v1/verify \
  -H 'content-type: application/json' \
  -d @-
```

```bash
curl -s http://localhost:3001/api/v1/receipt/<receiptId>
```

```bash
curl -s -X POST http://localhost:3001/api/v1/anchor/<receiptId>
```

OpenAPI spec: `apps/api/openapi.json`.

## Threat Model Notes

- Synthetic-only: no real PII is ingested or persisted.
- Receipts are immutable-style: integrity is derived from canonical JSON hashing.
- Anchoring stores only hashes; no document contents are posted on-chain.
- Trust registry validation rejects unsigned or tampered registries.

## Repo Layout

- `apps/api`: Fastify API + Prisma (SQLite)
- `apps/web`: Next.js portal UI
- `packages/core`: canonicalization, hashing, registry, verification engine
- `packages/contracts`: Solidity AnchorRegistry + deploy scripts
- `scripts/demo.ts`: end-to-end demo run

## Deed Shield v2 Risk & Proof Model

Deed Shield v2 introduces advanced risk detection and privacy-preserving proofs.

### 1. Document Fraud Risk Engine

An AI-driven module that analyzes deed PDFs for anomalies before recording.

- **Forensics**: Dectects suspicious metadata/timestamps.
- **Layout**: Validates structure against known templates.
- **Result**: Generates a `fraudRisk` object in the verification receipt (Low/Medium/High risk bands).

### 2. Zero-Knowledge Compliance (ZKP)

Proves policy compliance without revealing private transaction details (Notary ID, County codes).

- **Output**: `zkpAttestation` embedded in receipts.
- **Privacy**: Does not expose PII or internal rule logic.

### 3. Receipt Revocation

Allows lifecycle management of issued receipts.

- **Endpoint**: `POST /api/v1/receipt/:receiptId/revoke`
- **Mechanism**: Updates status in registry; reflected in verification responses.

### 4. Anchor Portability

Designed for multi-chain anchoring.

- **Stub**: `PortableAnchorManager` in core prepares for swapping anchor providers without invalidating historical proofs.

## Documentation

Full user documentation is available in the [User Manual](./USER_MANUAL.md).
