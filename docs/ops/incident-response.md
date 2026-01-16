# Incident Response Plan

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Scope
This plan covers the operational response to security incidents affecting the Deed Shield Verifier, specifically **Key Compromise** and **Erroneous Receipt Generation**.

## 2. Severity Levels
- **Sev-1 (Critical):** Loss of control of the Issuer Private Key.
- **Sev-2 (High):** System emitting invalid receipts (false positive "PASS").
- **Sev-3 (Medium):** Service outage or anchoring failure.

## 3. Response Procedures

### 3.1. Key Compromise (Sev-1)
If the `issuer.private.jwk.json` is suspected to be stolen:
1.  **Stop the Service:** Immediately shut down the API process to prevent unauthorized signing.
2.  **Generate New Key:** Run `node scripts/gen-issuer-keys.js` to create a new keypair.
3.  **Deploy New Key:** Replace the compromised key on the server.
4.  **Notify Stakeholders:** Inform pilot participants that receipts signed by the old key (Fingerprint X) are no longer trusted.

### 3.2. Receipt Revocation (Sev-2)
If a specific receipt was issued in error:
1.  **Identify JTI:** Locate the unique `jti` (JWT ID) of the bad receipt.
2.  **Execute Revocation:**
    ```bash
    curl -X POST http://localhost:3000/api/revoke \
      -H 'content-type: application/json' \
      -d '{"jti":"<TARGET_JTI>"}'
    ```
3.  **Verify Revocation:** Query `/api/verify` with the revoked JWT to confirm it returns `409 Conflict`.

## 4. Post-Incident Review
After any Sev-1 or Sev-2 incident, a Root Cause Analysis (RCA) must be drafted within 48 hours for review by general counsel.

---
*Change Log:*
- *v1.0.0: Initial generation based on Threat Model & API Capabilities (Source of Truth).*
