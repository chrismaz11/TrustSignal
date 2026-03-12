# TrustSignal Verification Lifecycle

TrustSignal is evidence integrity infrastructure for existing workflows. The verification lifecycle below shows the externally visible flow for producing verification signals, issuing signed verification receipts, and supporting later verification without exposing private verification engine internals.

## Lifecycle Diagram

```mermaid
flowchart TD
  A["Artifact or Evidence"]
  B["Verification Request"]
  C["TrustSignal Verification Engine"]
  D["Verification Result"]
  E["Signed Verification Receipt"]
  F["Receipt Storage"]
  G["Later Verification / Audit"]
  H["Tamper Detection"]

  A --> B
  B --> C
  C --> D
  D --> E
  E --> F
  F --> G
  G --> H
```

## Step Explanations

### 1. Artifact or Evidence

An external workflow collects or references an artifact that needs integrity-aware verification. This can be a document, evidence packet, or another workflow artifact that may be challenged later.

### 2. Verification Request

The workflow submits a verification request through the TrustSignal API boundary. The request binds the artifact context and provenance fields that downstream teams may need during later review.

### 3. TrustSignal Verification Engine

TrustSignal evaluates the request within the private verification environment. Public documentation does not expose internal proof systems, signing infrastructure, or service topology.

### 4. Verification Result

The engine returns verification signals that describe the outcome of the verification request. These signals are meant for downstream workflow logic, storage, and review.

### 5. Signed Verification Receipt

TrustSignal issues a signed verification receipt that captures the verification outcome and verifiable provenance for later verification.

### 6. Receipt Storage

The external workflow stores the receipt alongside its own record. TrustSignal does not replace the system of record; it adds integrity-layer outputs that the system of record can retain.

### 7. Later Verification / Audit

Before relying on the earlier result during audit review, partner review, or another high-loss workflow step, the workflow can request later verification against the stored receipt state.

### 8. Tamper Detection

If the current artifact or stored state no longer matches the receipt-bound record, later verification produces a mismatch signal that exposes tampering, substitution, or provenance drift.

## Trust Boundary Diagram

```mermaid
flowchart TD
  A["External Workflow / Partner System"]
  B["TrustSignal API Gateway"]
  C["Private Verification Engine"]
  D["Verification Result + Signed Receipt"]

  A --> B
  B --> C
  C --> D
```

## Boundary Explanation

- The external workflow or partner system remains the system of record.
- The TrustSignal API Gateway is the public integration boundary for verification and later verification requests.
- The private verification engine remains non-public.
- The public outputs are verification signals, signed verification receipts, and verifiable provenance suitable for later verification.
