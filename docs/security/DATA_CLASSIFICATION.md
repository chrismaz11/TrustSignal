# Data Classification

## 1. Executive Summary
This document defines the classification of data handled by the TrustSignal product suite and specifies the handling, storage, and exposure requirements for each level. TrustSignal operates as an integrity layer, where the primary public output is a signed verification receipt. Protecting the integrity of these receipts and the confidentiality of operational secrets is paramount.

## 2. Classification Levels

### Secret
Data that, if compromised, would lead to immediate and total loss of system integrity or unauthorized access to sensitive integrations.
*   **Examples**: Private signing keys, API keys, webhook secrets, GitHub App private keys.

### Confidential
Sensitive operational or partner data that must remain private to TrustSignal and its authorized partners.
*   **Examples**: Private receipt metadata, partner-only demo content, unmasked logs containing PII, internal API endpoints.

### Internal
Operational data used by TrustSignal staff for system maintenance and debugging.
*   **Examples**: Sanitized logs, CI/CD metadata, system metrics, non-sensitive configuration.

### Public
Information intentionally made available to the public or authorized evaluators without further authentication.
*   **Examples**: Redacted verification receipts, public documentation, landing page content.

## 3. Classification Principles
*   **Default to Redaction**: Receipts are public by default but must be returned in a redacted format unless authorized.
*   **Ephemeral by Design**: Raw artifact content should be processed ephemerally and not persisted unless explicitly required by the workflow.
*   **Log Hygiene**: Secrets and PII must be masked or redacted before reaching any persistent logging system.

## 4. Data Inventory Table

| Asset | Classification | Primary Storage | Publicly Visible? |
| :--- | :--- | :--- | :--- |
| **Receipt ID** | Public | Database / Receipt | Yes (unguessable) |
| **Artifact Hash** | Public | Database / Receipt | Yes |
| **Signed Verification Receipt** | Public (Redacted) | Database / JWS | Yes |
| **Public Receipt Fields** | Public | Database | Yes |
| **Private Receipt Metadata** | Confidential | Database | No |
| **API Keys** | Secret | Environment | No |
| **Signing Keys (Private)** | Secret | Environment | No |
| **Webhook Secret** | Secret | Environment | No |
| **GitHub App Private Key** | Secret | Environment | No |
| **Installation Tokens** | Secret | Memory | No |
| **Partner Session Secret** | Secret | Environment | No |
| **Logs / Diagnostics** | Internal | Log Provider | No |
| **CI Metadata** | Internal | GitHub Actions | No |
| **Partner Demo Content** | Confidential | Repository | No (Gated) |

## 5. Handling Requirements by Classification

| Requirement | Secret | Confidential | Internal | Public |
| :--- | :--- | :--- | :--- | :--- |
| **Encryption in Transit** | Required (TLS 1.2+) | Required (TLS 1.2+) | Required | Encouraged |
| **Encryption at Rest** | Required | Required | Encouraged | N/A |
| **Access Control** | Strictly Limited | Role-Based | Internal Only | None |
| **Logging** | Prohibited | Masked/Redacted | Allowed | Allowed |
| **Retention** | Lifecycle-managed | Lifecycle-managed | 30-90 days | Indefinite |

## 6. Public Receipt Redaction Model
The `trustsignal` core API implements a redacted public view for receipts accessed via `GET /api/v1/receipt/:receiptId`.
*   **Included Fields**: `receiptId`, `artifact` (hash/alg), `source` (provider/repo/workflow), `status`, `createdAt`, `receiptSignature`.
*   **Excluded Fields**: `verificationId`, `metadata` (e.g., local file paths), internal scoring details, witness data.
*   **Implementation**: Enforced via `toArtifactReceiptPublicView` in `artifactReceipts.ts`.

## 7. Logging and Diagnostics Rules
*   **Auth Redaction**: No raw `Authorization` or `x-api-key` headers may be logged.
*   **PII Minimization**: Logs should record hashes or identifiers instead of raw PII where possible.
*   **Action Logs**: `TrustSignal/github-actions/trustsignal-verify-artifact` must sanitize error outputs to prevent leaking secret-like strings (32+ alphanumeric chars).

## 8. Demo / Partner Access Data Rules
*   Partner demos in `v0-signal-new` are protected by a partner-specific password and a signed HMAC session cookie.
*   Session cookies include `iat` and `exp` to prevent indefinite persistence.
*   Partner passwords must be unique per partner and managed as Secret environment variables.

## 9. Retention / Exposure Considerations
*   **Verification Receipts**: Retained as long as the integrity of the associated artifact needs to be verifiable.
*   **Audit Logs**: Should be retained for at least 12 months for compliance purposes, provided they are sanitized.
*   **Installation Tokens**: Must be evicted from memory as soon as the GitHub API transaction is complete or the token expires.

## 10. Known Ambiguities / Future Decisions
*   **ZKP/Chain Data**: Classification of ZKP witness data and blockchain transaction metadata will be defined once these features move into production.
*   **Data Deletion**: A formal procedure for purging receipts upon partner request is yet to be codified.
