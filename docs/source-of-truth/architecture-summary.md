# Architecture Summary

> [!NOTE]
> This document was synthesized from codebase analysis.

## High-Level Topology
The Deed Shield system consists of three primary layers:
1.  **Ingestion & Verification API**: A Node.js (Fastify) service that processes uploads, runs verification logic, and manages local state (SQLite).
2.  **User Portal**: A Next.js web application for verifying documents and viewing results.
3.  **Encrypted Storage Layer**: Off-chain storage for verification metadata and receipts (simulated in pilot, encrypted object store in target).
4.  **Trust Anchor**: An EVM-compatible blockchain (Polygon Amoy) used for timestamping and immutable receipt storage.

## Key Components

### 1. API Service (`apps/api`)
- **Framework**: Fastify
- **Database**: SQLite (via Prisma ORM)
- **Role**:
    - Handles `POST /verify` and `POST /receipt`.
    - Manages issuer keys (filesystem).
    - Exposes public verification endpoints.

### 2. Verification Engine (`packages/core`)
- **Canonicalization**: deterministically serializes JSON inputs.
- **Hashing**: SHA-256 for document fingerprints.
- **Registry Client**: Fetches and validates notary credentials against the allowed list.

### 3. Anchoring Layer
- **Network**: Polygon Amoy (Testnet).
- **Contract**: Simple `AnchorRegistry` Solidity contract.
- **Behavior**: Periodically batches receipt hashes and commits them on-chain.

## Data Flow
1.  **Upload**: User uploads PDF + Metadata.
2.  **Hash**: System hashes PDF (client-side or server-side ephemeral).
3.  **Verify**: System checks metadata against Notary Registry.
4.  **Sign**: If valid, System signs a receipt with Issuer Key.
5.  **Anchor**: System submits receipt hash to Polygon.
6.  **Return**: User receives a JSON receipt (e.g., `PASS`/`FLAG` result).
