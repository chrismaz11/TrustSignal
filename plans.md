# TrustSignal ZKP Infrastructure Plan

Last updated: 2026-03-07

## BLUF

TrustSignal already contains a Halo2 Rust crate under `circuits/non_mem_gadget`. The repo now has a real external Halo2 proof round-trip for a bootstrap attestation circuit, the public `zkpAttestation` path is explicitly `dev-only` by default, production fails closed unless an external prover is configured, and anchor provenance is bound to a deterministic subject digest. The immediate remaining priority is replacing the bootstrap attestation flow with a real, auditable document-hash proof pipeline before expanding Vanta or EVM anchoring claims.

## Current State

### Confirmed present

- Halo2 circuit crate: `circuits/non_mem_gadget`
- TypeScript bridge to Rust verifier binary: `src/verifiers/halo2Bridge.ts`
- Combined verification flow for non-membership, revocation, and ZKML: `src/core/verifyBundle.ts`
- Vanta evidence endpoint: `GET /api/v1/integrations/vanta/verification/:receiptId`

### Confirmed blockers

- The live attestation path defaults to `dev-only`, but a real external prover backend now exists for `bootstrap-attestation-v0`.
- `apps/api/src/server.ts` persists dev-only attestations in non-production and only returns `proofVerified=true` when a verifiable external backend is configured.
- `apps/api/src/anchor.ts` and the API response surface now bind anchoring to an `anchorSubjectDigest`; the remaining contract-side caveat is that Hardhat 3 validation requires Node 22+ even though the broader repo still runs under Node 18+.
- The Halo2 crate now emits verifiable proof artifacts for `bootstrap-attestation-v0`, but the original non-membership and revocation circuits still use `MockProver`.
- The Halo2 crate uses a toy Merkle hash and synthetic witness derivation, so it is not yet suitable for adversarial or compliance-sensitive production use.
- A zero-trust external prover/verifier seam exists in `packages/core/src/zkp/index.ts` and is now backed by `circuits/non_mem_gadget/src/bin/zkp_service.rs`, but that binary currently proves only bootstrap public-input attestations.

## Trust Boundaries

### Sensitive inputs

- Document bytes and extracted document features
- Receipt IDs, bundle hashes, inputs commitments, revocation nullifiers
- API keys, JWT secrets, Polygon private keys, DB credentials

### Authentication and authorization surfaces

- `Authorization: Bearer` for TrustSignal `/v1/*`
- `x-api-key` and scoped API access for `/api/v1/*`
- Revocation signature headers for issuer-authorized revocation operations

### Compliance-sensitive outputs

- `zkpAttestation` persisted in receipts
- Vanta verification payloads under `/api/v1/integrations/vanta/verification/:receiptId`
- Evidence artifacts and structured logs consumed by audit and SOC 2 workflows

## Hard Pivot

Do not market the current bootstrap proof path as full document verification. First replace it with:

1. Explicit proof status metadata that distinguishes `dev-only`, `verifiable-bootstrap`, and the final document-hash proof.
2. A real proving/verifying pipeline for the document-hash statement, not only the bootstrap attestation circuit.
3. Evidence payloads that only claim verifiable proof properties actually enforced by code.

## Ordered Work Plan

### Phase 0: Containment

1. Mark the default attestation path as non-production in code and docs.
2. Stop emitting proof scheme names that imply deployable cryptographic validity.
3. Fix Vanta serialization so nested public inputs are mapped correctly and evidence can distinguish `mock` from `verified`.
4. Add regression tests that fail if mock proof code is used in production mode.

### Phase 1: Define the first real statement

Goal: bootstrap an initial Halo2 circuit for document hashing without exposing PII.

Statement:

- Private witness: canonicalized document bytes or chunked field representation, plus a per-document blinding salt.
- Public inputs:
  - `sha256_digest`
  - `document_commitment`
  - `schema_version`
- Constraints:
  - recompute SHA-256 over the canonicalized document witness
  - constrain `sha256_digest` to the computed digest
  - constrain `document_commitment = Poseidon(sha256_digest, blinding_salt, schema_version_tag)`

Security objective:

- External systems can verify that TrustSignal processed a specific canonical document and committed to it without learning the document contents or the blinding salt.

Non-goals for the first circuit:

- Full notary or registry validation inside the circuit
- OCR inside the circuit
- On-chain verification in the first milestone
- Any claim of HIPAA-grade handling beyond existing infrastructure controls

### Phase 2: Replace toy cryptography in Rust prover

1. Add a new Rust crate or module for the document-hash circuit instead of extending the bootstrap attestation or toy hash paths in place.
2. Use standard primitives only:
  - SHA-256 for canonical document digest
  - Poseidon only where field-native commitments are needed
3. Remove `DefaultHasher`-based witness derivation from production proof paths.
4. Define stable witness serialization and canonical input encoding.

### Phase 3: Real proof lifecycle

1. Add setup/keygen commands for proving and verifying keys for the document-hash circuit.
2. Emit proof artifacts plus explicit public input payloads.
3. Add verification commands that validate those artifacts outside `MockProver`.
4. Version proof formats and verification keys for auditability.

### Phase 4: TypeScript integration

1. Replace `generateComplianceProof()` bootstrap logic with a prover client that invokes the real document-hash Rust proof pipeline.
2. Persist:
  - proof scheme
  - verification key ID
  - public inputs
  - proof artifact digest
  - proof status
3. Fail closed when proof generation or verification fails.
4. Ensure logs contain request ID, action, target resource, and outcome without raw document data or PII.

### Phase 5: Vanta and evidence alignment

1. Define a Vanta-facing proof object that distinguishes:
  - `scheme`
  - `status`
  - `publicInputs`
  - `verificationKeyId`
  - `verifiedAt`
2. Export only commitments and proof metadata, never raw witness material.
3. Add schema and integration tests for `/api/v1/integrations/vanta/verification/:receiptId`.

### Phase 6: EVM anchoring

1. Anchor a versioned subject derived from `receiptHash + proofArtifact.digest + verificationKeyId`, not raw document data.
2. Version the anchoring payload so verifiers can reconstruct exactly what was attested.
3. Add chain-specific replay and nullifier handling tests before enabling production anchoring.

Status:

- Items 1 and 2 are partially implemented in the API and Solidity contract path via `anchorSubjectDigest` and `anchorSubjectVersion`.
- Item 3 remains open until the production prover backend exists and chain replay/nullifier tests are added.

## Engineering Tasks

### Immediate code tasks

1. Replace mock attestation terminology and add `proofStatus`.
2. Fix Vanta `conformance` extraction from `publicInputs`.
3. Add tests proving production mode rejects mock proof generation.
4. Scaffold a new document-hash circuit crate with:
   - witness schema
   - canonicalization interface
   - SHA-256 gadget selection
   - proof I/O format

### Validation gates

1. `cargo test` in the Rust prover crate(s)
2. Proof round-trip test: prove then verify using serialized artifacts
3. API tests covering successful and failed proof generation
4. Vanta payload tests asserting proof metadata is complete and non-misleading

## Success Criteria

- No mock proof logic is used in production paths.
- A document-hash proof can be generated and verified from stable serialized artifacts.
- API receipts expose only commitments and proof metadata, not PII.
- Vanta payloads are accurate, machine-verifiable, and audit-friendly.
- Proof and verification failures are fail-closed and fully traceable in structured logs.
