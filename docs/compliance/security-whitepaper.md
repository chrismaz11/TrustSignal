# Security & Privacy Whitepaper

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Executive Summary
Deed Shield enables the verification of physical and digital property records without acting as a central repository for sensitive document content. Our architecture is based on **cryptographic decoupling**, ensuring that the "truth" of a document's existence is mathematically proven without exposing its secrets.

## 2. Core Security Architecture

### 2.1. Client-Side Hashing & Data Minimization
The core principle of Deed Shield is **"Verify the Fingerprint, Not the File."**
- When a document bundle is presented for verification, the system calculates a SHA-256 hash of the canonicalized file content.
- This hash is the *only* artifact retained for long-term auditability.
- The original PDF file is discarded from memory immediately after the verification logic completes.

### 2.2. Immutable Receipting
Upon successful verification against the Notary Registry, the system issues a **JSON Receipt**.
- **Digital Signature:** The receipt is signed by the Deed Shield Issuer Key, proving it originated from our trusted environment.
- **Tamper Evidence:** Any modification to the receipt (e.g., changing a "FLAG" to "PASS") invalidates the issuer's signature.

### 2.3. Public Blockchain Anchoring
To prevent the "Internal Database Corruption" threat, Deed Shield periodically **anchors** batches of receipt hashes to the **Polygon Amoy** blockchain.
- This creates an undeniable timestamp.
- Even if Deed Shield's servers are destroyed, the proof that a specific document existed and was verified at a specific time remains on the public ledger.

## 3. Key Management
- **Issuer Keys:** Currently stored in isolated, access-controlled filesystems (`.jwk` files) on the verifier node.
- **Future Roadmap:** Migration to Hardware Security Modules (HSM) for production environments.

## 4. Threat Model Alignment
This architecture specifically addresses:
- **Data Leakage Risks:** By not storing PII.
- ** insider Threats:** By anchoring audit trails publically, preventing silent database alterations by rogue admins.

---
*Change Log:*
- *v1.0.0: Initial generation based on Threat Model & Architecture Summary (Source of Truth).*
