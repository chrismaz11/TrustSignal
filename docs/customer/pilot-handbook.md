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

1.  **Select a PDF:** Use a _sample_ deed (e.g., `sample.pdf`).
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

## 5. Trust Registry Management

To ensure zero-trust security during startup, the `TrustRegistry` is cryptographically signed using a detached P-256 ECDSA (ES256) signature.

### Signing the Registry

- The registry JSON (`registry.json`) is signed offline using a private key.
- The resulting signature is saved as `registry.sig`.
- You can generate a mock registry and keypair using `node scripts/generate-registry.mjs`.

### Key Management Expectations

- **Private Keys:** Must **never** be committed to the repository. They should be generated and stored securely offline or within a KMS (Key Management Service).
- **Public Keys:** The API verifies the registry using the public key. In production, this **MUST** be provided via the `TRUST_REGISTRY_PUBLIC_KEY` environment variable as a JSON Web Key (JWK). The service will refuse to start if this environment variable is missing.
- **Local Development:** For local testing, the system can fallback to reading the version-controlled `registry.public.jwk`.

---

_Change Log:_

- _v1.0.1: Added Trust Registry Management guidelines._
- _v1.0.0: Initial generation based on Demo Readme (Source of Truth)._
