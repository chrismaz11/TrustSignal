# DeedShield User Manual

**Version:** 2.0 (Risk & Compliance Enhanced)  
**Date:** February 2026

## 1. Overview
DeedShield is an automated document verification platform designed to prevent real estate title fraud. It protects homeowners and county clerks by ensuring:
1.  **Recording Integrity**: Documents meet strict Cook County formatting and content rules.
2.  **Fraud Detection**: An AI Risk Engine analyzes documents for signs of forgery or tampering.
3.  **Immutable Proof**: Every validation is "anchored" on a public blockchain (EVM), creating a permanent, tamper-proof audit trail.

---

## 2. Workflow Guide

### Step 1: Upload a Document
1.  Navigate to the Home Page.
2.  Locate the **"Instant Pre-Check"** dropzone.
3.  Drag & Drop your PDF file (e.g., Warranty Deed, Quitclaim Deed) into the box.
    *   *Note: Only PDF files are supported for full verification.*

### Step 2: Automated Extraction & Review
Once uploaded, DeedShield automatically:
*   **Removes Watermarks**: Strips "DO NOT COPY" or "UNOFFICIAL" stamps to read the text.
*   **Extracts Metadata**: Finds the **Parcel ID (PIN)** and **Grantor Name**.
*   **Computes Hash**: Generates a unique `SHA-256` digital fingerprint of your file.

**Action**: Verify the extracted PIN and Grantor Name shown on the screen. If they are incorrect, you can edit them in the next step.
Click **"Proceed to Recording"** to continue.

### Step 3: Verification
The system pre-fills the verification form with your document's data.
1.  **Review Inputs**: Ensure the `Parcel ID (PIN)` and `Grantor Name` fields are accurate.
    *   *Tip: Cook County PINs are 14 digits (e.g., `12-34-567-000-0000`).*
2.  **Select Profile**: Ensure `STANDARD_IL` is selected for Cook County documents.
3.  Click **"Verify Bundle"**.

### Step 4: Results & Receipt
DeedShield runs a comprehensive audit and produces a **Verification Receipt**.
*   **Decision**: 
    *   `ALLOW`: Safe to record.
    *   `FLAG`: Minor issues found (e.g., low visual quality, warnings).
    *   `BLOCK`: Critical failure (e.g., missing PIN, severe fraud risk).
*   **Receipt ID**: A unique UUID for this specific verification event.

---

## 3. Understanding Outputs

### A. Compliance Checks (Cook County)
The system checks against Illinois Statutes (§55 ILCS 5/3-5018).
*   **PASS**: All mandatory fields (PIN, Legal Description, Prepared By, Mail To) are present.
*   **FAIL**: A critical recording requirement is missing. The receipt will cite the specific missing field (e.g., *"CRITICAL FAILURE: Legal Description missing"*).

### B. Fraud Risk Score
The **Document Fraud Risk Engine** assigns a probability score (0.0 - 1.0) based on forensics.

| Band | Score | Meaning |
| :--- | :--- | :--- |
| **🟢 LOW** | `0.0 - 0.3` | Document appears authentic. |
| **🟡 MEDIUM** | `0.31 - 0.7` | Suspicious layout or text anomalies. Manual review recommended. |
| **🔴 HIGH** | `0.71 - 1.0` | **High likelihood of fraud.** Issues like modified metadata or template mismatches detected. |

### C. Anchoring
*   **"Anchored" Status**: The digital fingerprint (hash) of your receipt has been written to the Ethereum blockchain.
*   **Proof**: This proves *exactly* what the document looked like and what the verification result was at that specific moment in time. Even DeedShield cannot alter this record later.

---

## 4. Troubleshooting
*   **"OCR Failed"**: The document may be too blurry or encrypted. Try scanning at a higher resolution (300 DPI).
*   **"Cook County Compliance Failed"**: Read the specific error message. You likely forgot a mandatory header like "Prepared By" or the "Return To" address.
*   **Wrong PIN Extracted**: Use the manual edit fields on the Verify page to correct the PIN before submitting.
