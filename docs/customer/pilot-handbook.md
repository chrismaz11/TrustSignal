# Pilot Program Handbook

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Welcome
Welcome to the Deed Shield **Verifier Simulator Pilot**. This handbook will guide you through testing the pre-recording verification workflow.

## 2. Accessing the Simulator
- **URL:** `http://localhost:3000/demo` (Local Deployment)
- **Status:** **Offline / Local Mode** typically.

## 3. Step-by-Step Walkthrough

### 3.1. Preparing Your Bundle
1.  **Select a PDF:** Use a *sample* deed (e.g., `sample.pdf`).
    > [!WARNING]
    > **Do NOT upload real PII.** Use redacted or synthetic documents only.
2.  **Metadata Entry:**
    - **Jurisdiction:** Enter `CA-LA` (California - Los Angeles) for the test.
    - **Notary ID:** Enter `NOTARY-123` (Authorized Test ID).
    - **Document Type:** Select `DEED`.

### 3.2. Running Verification
1.  Click **"Verify Bundle"**.
2.  The system will hash the PDF and check the Notary ID against the local registry.
3.  **Result:** You will see a `PASS` or `FLAG` status.

### 3.3. Understanding the Receipt
The system generates a JSON receipt.
- **PASS:** The Notary ID is valid, and the document hash is fresh.
- **FLAG:** The Notary ID is unknown, suspended, or metadata is missing.

## 4. Troubleshooting
- **"Network Error":** Ensure the API server is running (`npm run dev`).
- **"Anchor Mismatch":** The Polygon Amoy testnet might be congested. Wait 5 minutes and retry.

---
*Change Log:*
- *v1.0.0: Initial generation based on Demo Readme (Source of Truth).*
