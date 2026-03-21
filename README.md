# TrustSignal

[![trustsignal.dev](https://img.shields.io/badge/trustsignal.dev-live-brightgreen)](https://trustsignal.dev)
[![Docs](https://img.shields.io/badge/docs-available-blue)](https://trustsignal.dev/docs)
[![Pilot](https://img.shields.io/badge/pilot-open-orange)](https://trustsignal.dev/#pilot-request)
[![Email](https://img.shields.io/badge/contact-info%40trustsignal.dev-lightgrey)](mailto:info@trustsignal.dev)

**Evidence integrity infrastructure for compliance and audit workflows.**

TrustSignal issues signed verification receipts so organizations can prove when evidence was created, where it came from, and whether it has changed. It adds an integrity layer to existing workflows without replacing the system of record.

→ **[trustsignal.dev](https://trustsignal.dev)** · **[Documentation](https://trustsignal.dev/docs)** · **[Request a Pilot](https://trustsignal.dev/#pilot-request)**

---

## The Problem

Compliance and audit teams rely on artifacts that pass through multiple systems. Without a durable integrity reference, provenance becomes difficult to validate during later review:

- Evidence files, exports, and screenshots can change after initial collection
- Weeks or months later, reviewers cannot easily prove where an artifact came from or when it was captured
- Audit readiness weakens without a reliable tamper-evident reference

---

## How TrustSignal Works

Submit an artifact or artifact reference -> receive a signed verification receipt -> store it with the artifact -> verify again later when trust conditions matter.

```
┌─────────────────┐    POST /api/attest-evidence    ┌──────────────────┐
│  Your Workflow  │ ──────────────────────────────► │   TrustSignal    │
│  (Vanta, Drata, │                                 │  Integrity Layer │
│   internal GRC) │ ◄────────────────────────────── │                  │
└─────────────────┘    Signed receipt + signal      └──────────────────┘
        │
        ▼
  Store receipt alongside artifact in your system of record
        │
        ▼
  Later verification: compare current artifact against original receipt
```

### Verification Request

```json
POST /api/attest-evidence
Content-Type: application/json

{
  "source": "vanta",
  "artifact_hash": "sha256:93f6f35a550cbe1c3f0b5f0c12b9f0d62f3f9c6f8c6a4eddd8fa1fbfd4654af1",
  "control_id": "CC6.1",
  "timestamp": "2026-03-11T21:00:00Z",
  "metadata": {
    "artifact_type": "compliance_evidence",
    "collector": "aws-config-snapshot"
  }
}
```

### Signed Receipt Response

```json
HTTP/1.1 201 Created

{
  "receipt_id": "tsig_rcpt_01JTQY8N1Q0M4F4F5T4J4B8Y9R",
  "status": "signed",
  "source": "vanta",
  "control_id": "CC6.1",
  "attested_at": "2026-03-11T21:00:01Z",
  "signature": "tsig_sig_01JTQY8QK6X4YF7M6T2P9A5D3H",
  "provenance": {
    "artifact_type": "compliance_evidence",
    "collector": "aws-config-snapshot"
  }
}
```

---

## Integration Fit

TrustSignal sits **behind** the system that collected the artifact.

| Layer | What Stays in Place |
|---|---|
| Evidence collection | Your existing platform (Vanta, Drata, internal collector) |
| System of record | Unchanged - TrustSignal adds to it, not replaces it |
| Review workflow | Existing compliance or audit process |
| **TrustSignal** | **Attests at ingestion. Signed receipt travels with artifact.** |

No workflow replacement required. Integrates at clear API boundaries.

---

## Receipt Model

```typescript
const auditReadyReceipt = {
  receipt_id: "tsig_rcpt_01JTQY8N1Q0M4F4F5T4J4B8Y9R",
  source: "vanta",
  artifact_hash: "sha256:93f6f35a550cbe1c3f0b5f0c12b9f0d62f3f9c6f8c6a4eddd8fa1fbfd4654af1",
  control_id: "CC6.1",
  timestamp: "2026-03-11T21:00:00Z",
  receipt_status: "signed",
  verification_status: "match",
  provenance: {
    artifact_type: "compliance_evidence",
    collector: "aws-config-snapshot"
  }
}
```

---

## Documentation

| Resource | Link |
|---|---|
| Developer Overview | [trustsignal.dev/docs](https://trustsignal.dev/docs) |
| Verification Lifecycle | [trustsignal.dev/docs/verification](https://trustsignal.dev/docs/verification) |
| API Overview | [trustsignal.dev/docs/api](https://trustsignal.dev/docs/api) |
| Security Model | [trustsignal.dev/docs/security](https://trustsignal.dev/docs/security) |
| Architecture | [trustsignal.dev/docs/architecture](https://trustsignal.dev/docs/architecture) |
| Threat Model | [trustsignal.dev/docs/threat-model](https://trustsignal.dev/docs/threat-model) |

---

## Claims Boundary

**TrustSignal provides:**
- Signed verification receipts
- Verification signals
- Verifiable provenance metadata
- Later integrity check capability

**TrustSignal does not provide:**
- Legal determinations
- Compliance certification
- Fraud adjudication
- Replacement for the system of record

---

## Security

Public documentation does not expose proof internals, signing infrastructure specifics, or internal service topology.

For security review materials: [trustsignal.dev/security](https://trustsignal.dev/security)

To report a vulnerability: [info@trustsignal.dev](mailto:info@trustsignal.dev)

---

## Pilot Access

Operational access and private verification workflows are restricted to TrustSignal pilot review.

→ [Request a lightweight pilot](https://trustsignal.dev/#pilot-request)

---

## Contact

[trustsignal.dev](https://trustsignal.dev) · [info@trustsignal.dev](mailto:info@trustsignal.dev)
