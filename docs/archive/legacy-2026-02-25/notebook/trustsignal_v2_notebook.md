
# Deed Shield v2.0 - Notebook Log

## 1) Purpose of v2.0
The purpose of Deed Shield v2.0 is to enhance the pre-recording verification process by introducing advanced risk detection, privacy-preserving compliance proofs, and receipt lifecycle management. This upgrade aims to provide stakeholders with actionable fraud risk signals without exposing sensitive data, while ensuring the system is ready for future multi-chain interoperability.

## 2) What Changed (High Level)
- **Fraud Risk Analysis**: Added an automated engine to score document risk based on file forensics and layout consistency.
- **Privacy Proofs**: Introduced Zero-Knowledge Proof (ZKP) attestations to prove policy compliance without revealing internal business rules or PII.
- **Receipt Schema**: Updated the output receipt format to version 2.0, standardization of nested fields (`fraudRisk`, `zkpAttestation`, `revocation`).
- **Lifecycle Management**: Added the ability to revoke issued receipts if validitity is later challenged.
- **Architecture**: Modularized verification logic and created a dedicated v2 receipt mapper for consistent API responses.

## 3) What Did NOT Change (Guardrails)
- **Data Privacy**: No Personal Identifiable Information (PII) is persisted. Document content is processed in memory and discarded.
- **Core Verification**: The underlying cryptographic signature verification and notary authority checks remain the foundation of trust.
- **Backward Compatibility**: Existing API endpoints continue to function, but now return the v2 structure which encapsulates all previous data.

## 4) New Modules

### Fraud Risk Engine
A modular analysis pipeline located in `packages/core/src/risk`.
- **Input**: PDF document buffer.
- **Logic**:
    - **Forensics**: Scans PDF metadata for anomalies (e.g. modification dates preceding creation, suspicious producer tools).
    - **Layout**: Checks for expected templates (e.g. "CALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT") based on policy profile.
    - **Patterns**: Validates consistency between notary commission state and policy expectations.
- **Output**: A `DocumentRisk` object containing a score (0.0-1.0), risk band (LOW/MEDIUM/HIGH), and specific risk signals.

### ZKP Policy Compliance Attestation
Located in `packages/core/src/zkp`.
- **Function**: `generateComplianceProof` creates a cryptographic commitment linking the policy, the verification result, and the input data.
- **Implementation (Mock)**: Currently a "Mock" ZKP scheme (`GROTH16-MOCK-v1`) that hashes public inputs with a salt.
- **Privacy**: The verifier can confirm the proof matches the public claim "Compliance = TRUE" without seeing the raw inputs or specific failed checks.
- **TODO**: Swap the deterministic hash logic for a real zk-SNARK prover/verifier circuit (e.g. Circom/SnarkJS).

### Receipt Revocation & Unlinkability
- **Mechanism**: A new `revoked` boolean field in the database `Receipt` model.
- **API**: `POST /api/v1/receipt/:id/revoke` allows authorized systems to mark a receipt as invalid.
- **Privacy**: Revocation is a status flag; it does not link to a new identity or reasoning that exposes the user.
- **Verification**: The `verify` endpoints now check and return this status as `revocation: { status: "REVOKED" }`.

### Anchor Portability Stub
Located in `packages/core/src/anchor/portable.ts`.
- **Design**: Defines `AnchorProvider` interface for abstracting blockchain backends.
- **Manager**: `PortableAnchorManager` stub logic to route requests to active chains while maintaining verification for historical chains.
- **Future**: Allows switching from local EVM to Polygon/Ethereum Mainnet without code rewrites or invalidating old receipts.

## 5) Data Handling & Privacy
- **Stored**: Receipt metadata (ID, Hash, Scores, Proofs), Revocation status.
- **Never Stored**: Original PDF documents, raw PII from OCR (processed and discarded), internal Notary ID lists (referenced by ID only).
- **ZKP**: Ensures that even the "proof" of compliance does not leak *why* a document passed or failed, only that it did according to a specific policy hash.

## 6) Receipt Schema v2

### Plain English Description
The new receipt contains standard verification results plus:
- **Fraud Risk**: How risky the document looks.
- **ZKP Attestation**: A cryptographic token proving we checked the rules.
- **Revoked**: Has this receipt been cancelled?

### JSON Example
```json
{
  "receiptVersion": "2.0",
  "decision": "ALLOW",
  "reasons": [],
  "receiptId": "e1d38e98-bce4-47c4-b97c-13bdf9b55e50",
  "receiptHash": "0xb34db1e288f84e2aa5d2b3996a8da8d270e43c87f087c3b50f68e0dfa6b9f6b8",
  "anchor": {
    "status": "PENDING",
    "backend": "EVM_LOCAL"
  },
  "fraudRisk": {
    "score": 0,
    "band": "LOW",
    "signals": []
  },
  "zkpAttestation": {
    "proofId": "ZKP-1769197687360-938",
    "scheme": "GROTH16-MOCK-v1",
    "publicInputs": {
      "policyHash": "0xd9feb001ffd18fc36af16bd178edb4bd539032b1e334e37c5622f969579429f9",
      "timestamp": "2026-01-23T19:48:07.360Z",
      "inputsCommitment": "0x0fa863e1cb167263d67dfc642291bba99dc299ce520d9f4ff3f5dbde16b17077",
      "conformance": true
    },
    "proof": "0xa0b2260f36023add6d0ebdf32454d985877d7ca8db21d31c79a2e15d73f3a68e"
  },
  "revocation": {
    "status": "ACTIVE"
  }
}
```

## 7) How to Verify a Receipt
1.  **Fetch**: Retrieve receipt JSON from storage or API (`GET /api/v1/receipt/:id`).
2.  **Check Hash**: Re-compute `keccak256(canonicalize(receipt))` and match against `receiptHash`.
3.  **Check Revocation**: Ensure `revocation.status` is "ACTIVE".
4.  **Verify ZKP**: Pass `zkpAttestation` to `verifyComplianceProof()` to ensure the proof is valid and `conformance` is true.
5.  **Check Risk**: Review `fraudRisk.band`. If 'HIGH', manual review is recommended.

## 8) Test Plan
We test to ensure trust and reliability.
- **Unit Tests**:
    - **Risk Engine**: Verify that bad PDFs trigger specific signals (Forensics/Layout) and affect the score.
    - **ZKP**: Verify that valid inputs generate verified proofs, and tampered inputs fail verification.
- **Integration Tests**:
    - **API Flow**: Verify the full lifecycle: Submit Bundle -> Get v2 Receipt -> Verify Fields are present -> Revoke -> Verify Revocation status.
    - **Mocks**: Ensure mock verifiers behave deterministically for consistent testing.

## 9) Test Evidence Log

### Automated Test Run
**Timestamp**: 2026-01-23

**Command**: `npm test packages/core/src/risk/risk.test.ts`
- **Result**: PASSED (6/6 tests)
- **Scope**: Risk Engine logic (Metadata checks, Template matching, Scoring).

**Command**: `npm test packages/core/src/zkp/zkp.test.ts`
- **Result**: PASSED (2/2 tests)
- **Scope**: ZKP generation and verification logic (Mock scheme).

**Command**: `npm test --workspace apps/api`
- **Result**: PASSED
- **Scope**: End-to-End API integration.
    - Confirmed `receiptVersion` is "2.0".
    - Confirmed `fraudRisk` object structure (score 0-1, band enum).
    - Confirmed `revocation` object structure (status enum).
    - Confirmed `riskScore` and `revoked` are ABSENT from root.

## 10) Known Gaps / TODOs
- [ ] **Real ZKP**: The current ZKP implementation is a cryptographic hash commitment (Mock). It must be replaced with a real Circuit (Circom) and SnarkJS prover for production privacy.
- [ ] **Real Forensics**: The PDF analysis uses string matching on a buffer. Production should use a proper PDF parser (e.g. `pdf-lib` or `pdf-parse`) to inspect internal object streams.
- [ ] **Anchor Implementation**: The `PortableAnchorManager` is a design stub. Real blockchain connectors need to be instantiated.

## 11) Risks & Failure Modes
- **False Positives**: The Risk Engine might flag legitimate custom templates as "Template Mismatch".
    - *Mitigation*: The system returns a "Signal" for human review, it does not auto-block unless configured.
- **ZKP Trust**: The Mock ZKP relies on the server's honesty (trusted setup).
    - *Mitigation*: This is noted as a "Stub" for v2.0 prototype. True ZKP removes this trust requirement.
- **Revocation Sync**: If the registry database is offline, revocation status cannot be checked.
    - *Mitigation*: Receipts include a "valid at" timestamp, but real-time revocation requires API uptime.

## 12) Change Log
- **feat(risk)**: Created modular Risk Engine (Forensics, Layout, Patterns).
- **feat(zkp)**: Implemented Mock ZKP generation and verification logic.
- **test(core)**: Added unit tests for Risk and ZKP modules.
- **feat(api)**: Implemented `v2ReceiptMapper` and updated `server.ts` to enforce v2 API contract.
- **feat(db)**: Added `revoked`, `fraudRisk`, `zkpAttestation` to Prisma schema.
- **test(api)**: Updated integration tests to strictly enforce v2 schema (no deprecated fields).
- **doc(v2)**: Updated notebook log with real v2 receipt example.
