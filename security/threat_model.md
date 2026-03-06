# TrustSignal Threat Model (Session 6)

Date: 2026-03-02  
Scope: TrustSignal API verification and revocation flow, Halo2 + ZKML proof paths, admin authentication, Polygon Mumbai anchoring.

## 1) Proof Forgery

- Likelihood: Medium
- Impact: High
- Attack: Adversary submits forged/invalid proof artifacts to bypass verification and obtain a false-valid result.
- Mitigation:
  - Halo2 verification bridge validates non-membership and revocation proof outcomes.
  - ZKML verification checks proof validity (`proven`) and fails closed on verification errors.
  - CI enforces regression tests for verification logic and strict TypeScript checks.

## 2) Nullifier Replay

- Likelihood: Medium
- Impact: High
- Attack: Previously valid bundle/nullifier is replayed to evade revocation state changes or duplicate acceptance.
- Mitigation:
  - Revocation checks include nullifier-based status evaluation.
  - `/v1/revoke` persists revocation status and anchor tx metadata in record store.
  - Status endpoint exposes revocation state for downstream trust decisions.

## 3) Model Inversion (ZKML)

- Likelihood: Low-Medium
- Impact: Medium
- Attack: Adversary probes model behavior to infer sensitive model characteristics or sensitive training correlations.
- Mitigation:
  - ZK pathway verifies outputs without exposing model internals.
  - API returns bounded fraud score and proof status only; no model weights/witness details are exposed.
  - Added adversarial test suite (20 cases) to detect unstable scoring behavior under perturbation/edge/fraud patterns.

## 4) Admin JWT Theft

- Likelihood: Medium
- Impact: High
- Attack: Stolen admin token used to revoke legitimate bundles.
- Mitigation:
  - Bearer JWT required on protected routes; `/v1/revoke` requires admin claim.
  - JWT key rotation supported via `TRUSTSIGNAL_JWT_SECRETS`.
  - Structured logs include request metadata (`request_id`, route, status, bundle hash) for abuse investigation.
  - Authorization header redacted in logs.

## 5) Polygon Anchor Manipulation

- Likelihood: Medium
- Impact: Medium-High
- Attack: Malicious or misconfigured RPC/network response causes false anchor trust assumptions.
- Mitigation:
  - Anchor flow validates Mumbai chain ID before transaction submission.
  - Revocation route rejects invalid anchor timestamps and surfaces upstream failures without leaking internals.
  - Tx hash and timestamp are persisted for traceability and independent chain verification.
