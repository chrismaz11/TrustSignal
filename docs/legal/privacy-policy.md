# Privacy Policy

**Version:** 1.0
**Date:** 2026-01-16

---

## 1. Introduction
This Privacy Policy describes how Deed Shield ("we", "us") collects, processes, and stores data when you use our verification platform. We act as a data processor for the documents you submit for verification.

## 2. Data We Collect
We collect the following categories of data:
- **Account Information:** Name, email, and API keys for account management.
- **Verification Metadata:** Technical details about the files you verify (e.g., file size, notarization timestamp).
- **Hashed Artifacts:** Cryptographic fingerprints (hashes) of the documents you upload.
- **Usage Logs:** IP addresses and API access timestamps for security monitoring.

## 3. How We Process Document Data
**We operate on a "Verify and Discard" basis.**
1.  **Hashing:** When you upload a document, we calculate a cryptographic hash (SHA-256) in memory.
2.  **No Content Storage:** We do **NOT** store the content of the deeds or documents you verify. The raw file is deleted immediately after the hashing process completes.
3.  **Off-Chain Encrypted Storage:** We store the *metadata* and the *receipt* (the proof of verification) in an encrypted off-chain storage layer. This ensures that while the proof persists, it is protected from unauthorized access.

## 4. Blockchain Anchoring
We may anchor the *receipt hash* to a public blockchain (e.g., Polygon Amoy) to create a tamper-evident timestamp.
- **Public Visibility:** Data written to the blockchain is public and immutable.
- **No PII on Chain:** We strictly allow only the *hash* of the receipt to be anchored. No personal names, addresses, or document details are written to the blockchain.

## 5. Retention and Deletion
- **Transient Data (uploads):** Deleted immediately (0-second retention).
- **Receipts:** Retained indefinitely to provide an audit trail, unless deletion is requested.
- **Logs:** Retained for 30 days.

## 6. Access and User Rights
You have the right to:
- **Request a copy** of the receipts associated with your account.
- **Request deletion** of your off-chain account data. *Note: We cannot delete hashes that have already been anchored to the public blockchain.*

## 7. Subprocessors
We use the following third-party infrastructure providers:
- **Cloud Hosting Provider:** [AWS/GCP/Azure - Region US-East]
- **Blockchain Node Provider:** [Infura/Alchemy]

## 8. No Regulatory Claims
This policy is strictly a description of our data practices. We **do not** claim compliance with specific sectoral regulations such as HIPAA, GLBA, or FERPA unless explicitly stated in a separate Data Processing Agreement (DPA).

---
*End of Privacy Policy v1.0*
