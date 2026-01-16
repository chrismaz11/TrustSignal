# Data Retention & Destruction Policy

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Data Classification
- **Category A (Ephemeral):** Raw Input Documents (PDFs).
- **Category B (Permanent):** Verification Receipts (JSON, Hashes).
- **Category C (System):** Application Logs, API Access Logs.

## 2. Retention Schedule

### 2.1. Raw Input Documents (Category A)
**Retention Period:** 0 Seconds (Process-and-Discard).
- **Policy:** The Deed Shield Verifier is configured to process the file stream in memory to calculate the SHA-256 hash. The file is never written to the database or long-term storage.
- **Destruction:** Immediate upon completion of the HTTP request.

### 2.2. Verification Receipts (Category B)
**Retention Period:** Indefinite (Audit Trail).
- **Policy:** Receipts are cryptographic proofs of verification. They are stored locally in SQLite and their hashes are anchored on-chain.
- **Destruction:** Only upon explicit "Right to be Forgotten" request (which invalidates the audit trail) or system decommissioning.

### 2.3. System Logs (Category C)
**Retention Period:** 30 Days (Rolling).
- **Policy:** Server logs (stdout/stderr) are retained for debugging and security auditing.
- **Destruction:** Automated log rotation overwrites files older than 30 days.

## 3. Media Sanitization
Upon decommissioning of the physical hardware or cloud instance hosting the Verifier, the underlying storage volumes must be securely wiped using NIST 800-88 compliant methods.

---
*Change Log:*
- *v1.0.0: Initial generation based on Privacy Policy & Architecture (Source of Truth).*
