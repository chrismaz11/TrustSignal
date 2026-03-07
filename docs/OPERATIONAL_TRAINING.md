# Operational Training Manual

## Role-Based Visual Guides

### 1. Closing Operator (Attestation)

**Objective**: Verify document integrity before recording.

**Workflow**:

1.  **Select Role**: Click "Closing Operator" at the top of the dashboard.
2.  **Upload Bundle**: Drag and drop the deed PDF into the "File Dropzone".
3.  **Check Auto-Fill**: Ensure the Grantor Name and Parcel ID (PIN) are correct.
4.  **Submit Attestation**: Click "Submit Attestation". The system will cryptographically sign the receipt.
5.  **Review Decision**:
    - 🟢 **ALLOW**: Risk score < 30. Secure for recording.
    - 🟡 **FLAG**: Risk score 30-59. Review indicated reasons (e.g., "Rapid Transfer Pattern").
    - 🔴 **BLOCK**: Risk score > 60. **Do not record**. Wait for supervisor approval.
6.  **Download Receipt**: Save the `.pdf` receipt for your closing file.

---

### 2. County Recorder / Verifier (Verification)

**Objective**: Validate a previously issued receipt.

**Workflow**:

1.  **Select Role**: Click "Verifier / Recorder".
2.  **Enter ID**: Input the unique `Receipt ID` provided by the Closing Operator.
3.  **Check Status**: Click "Check Status".
4.  **Interpret Result**:
    - **VALID**: The receipt exists, the hash matches, and it has **NOT** been revoked.
    - **INVALID**: The receipt hash does not match the database (Tampering Alert).
    - **REVOKED**: The receipt was explicitly voided by an admin (Red Text Alert).

### 3. "Green Light / Red Light" Protocol

| Signal               | Action Required                                  |
| :------------------- | :----------------------------------------------- |
| **All Checks PASS**  | Proceed to Record.                               |
| **One or More WARN** | Proceed with Caution. Add note to file.          |
| **One or More FAIL** | **STOP immediately**. Do not record. Contact IT. |

## Troubleshooting

- **"Integrity Check Failed"**: The file you uploaded does not match the hash in the bundle. You may have the wrong version of the deed.
- **"Receipt Revoked"**: This transaction was flagged post-closing. Do not trust the paper copy.
