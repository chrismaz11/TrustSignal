# System Operations Manual

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. System Overview
This manual defines the standard operating procedures for the Deed Shield Verifier Node (Pilot Configuration).

## 2. Installation & Environment

### 2.1. Prerequisites
- **Runtime:** Node.js v18+
- **Database:** SQLite3 (local)
- **Network:** Outbound access to Polygon Amoy RPC (TCP 443).

### 2.2. Deployment
1.  Clone the repository to the secure host.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Initialize the local database:
    ```bash
    npm -w apps/api run db:generate
    npm -w apps/api run db:push
    ```

## 3. Key Management
**CRITICAL:** The security of the verification receipts depends entirely on the `issuer.private.jwk.json` file.
- **Location:** `keys/issuer.private.jwk.json` (Default).
- **Access Control:** This file must be readable *only* by the service user account running the API.
- **Backup:** Rotate keys quarterly. Store backup keys in an offline, air-gapped location.

## 4. Service Execution
To start the API service in production mode:
```bash
npm -w apps/api start
```
*Note: Ensure environment variables `SEPOLIA_RPC_URL` (or Amoy equivalent) and `PRIVATE_KEY` are set for anchoring.*

---
*Change Log:*
- *v1.0.0: Initial generation based on Architecture Summary (Source of Truth).*
