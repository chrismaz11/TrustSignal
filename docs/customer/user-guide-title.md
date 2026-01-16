# User Guide: Title Company (Simulator)

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Introduction
This guide explains how **Title Companies** (Settlement Agents) can use the Deed Shield Simulator to pre-verify closing packets before attempting to record them.

## 2. The Problem
Recording a document with a revoked notary or missing jurisdiction metadata can lead to **rejection** by the county recorder, causing funding delays. The Deed Shield Simulator allows you to "dry run" this check.

## 3. Workflow

### 3.1. Pre-Closing Check
1.  Receive the signed PDF packet from the Notary (e.g., via RON platform).
2.  Log in to the Deed Shield Simulator.
3.  Upload the PDF.
    - **Note:** Ensure you are using the *final* signed version, not a draft. Any pixel change alters the hash.
4.  Run Verification.

### 3.2. Interpreting Results
- **PASS:** The notary was active at the time of signing (simulated), and the digital signature is valid.
    - *Action:* Proceed to recording submission.
- **FLAG (Revoked):** The notary's commission has been suspended or revoked.
    - *Action:* **HALT.** Do not fund the loan. Contact the signing service immediately.
- **FLAG (Integrity Fail):** The PDF has been modified after signing.
    - *Action:* **HALT.** Request a clean copy from the notary platform.

## 4. Reporting Issues
If a valid notary is flagged as invalid in the Simulator, please use the "Report False Positive" link in the demo dashboard.

---
*Change Log:*
- *v1.0.0: Initial generation based on Product Definition (Source of Truth).*
