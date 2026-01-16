# Assumptions Register & Approval Log

**Date:** 2026-01-16
**Status:** Pending User Approval

This document summarizes the critical assumptions used to generate the Deed Shield documentation stack.

## 1. Operational Assumptions
- **Simulator Status**: The system is a "Verifier Simulator" and NOT a production recording system. It does not connect to live county databases.
- **Key Management**: Keys are currently file-based (JWK) for the pilot. Production will mandate HSM/KMS, but docs currently reflect the pilot state.
- **Off-Chain Storage**: We assume the existence of an "Encrypted Off-Chain Storage" layer for metadata/receipts in the target architecture, even if the current local demo uses plain SQLite.
- **Blockchain**: We rely on **Polygon Amoy (Testnet)** for anchoring.

## 2. Compliance Assumptions (Data Privacy)
- **Synthetic Data Mandate**: We assume strict usage of *synthetic* data for pilots.
- **Redaction Ambiguity**: We assume *redacted* real-world data is **PROHIBITED** unless explicitly authorized, to avoid reversible PII leakage.
- **Ephemeral Processing**: The system hashes PDFs in memory and discards the file immediately. It does *not* act as a document custodian.

## 3. Legal Assumptions
- **Governing Law**: State of Illinois.
- **Liability Cap**: Limited to fees paid (or nominal $100 for free pilots).
- **Service Definition**: "Master Service Terms" covers the Verifier API and portal.
- **No Warranty**: Service is "AS IS" / Beta.
- **Regulatory Status**: We assume Deed Shield is a *technology provider*, not a *title insurer* or *designated government agent*.

## 4. Pending Decisions (Requires Approval)
1.  **Encryption Implementation**: Privacy Policy now claims "off-chain encrypted storage". This may not match the current `sqlite` demo implementation. *Is this acceptable for the "Target Architecture" documentation?*
2.  **Redaction Policy**: Can we strictly ban redacted keys?
