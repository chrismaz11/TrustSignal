# Key Management

## 1. Executive Summary
TrustSignal's security posture relies on the integrity and confidentiality of several classes of cryptographic keys and sensitive credentials. This document defines the lifecycle, storage, and operational requirements for these assets across the TrustSignal product suite. The current model assumes a split between long-lived root secrets and short-lived operational tokens.

## 2. Scope
This document covers:
* Receipt signing keys (JWK material)
* API keys and scoped service credentials
* GitHub integration secrets (webhook secrets, App private keys)
* Short-lived installation tokens
* Session signing secrets (Partner access)

## 3. Key and Secret Inventory

| Asset | Type | Purpose | Longevity |
| :--- | :--- | :--- | :--- |
| **Receipt Signing Key** | Ed25519 (JWK) | Signs verification receipts | Long-lived |
| **API Keys** | Opaque String | Authenticates service-to-service calls | Long-lived |
| **Webhook Secret** | HMAC Secret | Verifies inbound GitHub webhooks | Long-lived |
| **GitHub App Private Key** | RSA PEM | Authenticates as the GitHub App | Long-lived |
| **Installation Token** | Scoped JWT | Calls GitHub API for specific installs | Short-lived (1h) |
| **Partner Session Secret** | HMAC Secret | Signs partner access cookies | Long-lived |
| **Internal API Key** | Opaque String | Authenticates administrative operations | Long-lived |

## 4. Trust Boundaries for Each Secret Type
* **Receipt Signing Keys**: Resident only in the `trustsignal` core API runtime. Never exposed to clients.
* **API Keys**: Shared between authorized callers (e.g., `TrustSignal-App`) and the `trustsignal` core API.
* **Webhook Secret**: Shared between GitHub and the `TrustSignal-App` ingress.
* **GitHub App Private Key**: Resident only in the `TrustSignal-App` runtime.
* **Installation Tokens**: Generated in memory by `TrustSignal-App`; must never be persisted to disk or logs.
* **Partner Session Secret**: Resident only in the `v0-signal-new` runtime.

## 5. Generation and Storage Model
* **Operational Secrets**: Should be generated using cryptographically secure random number generators (CSPRNG).
* **Production Storage**: Secrets must be injected into the runtime environment via encrypted platform-native secret management (e.g., Vercel Environment Variables, GitHub Actions Secrets).
* **Local Development**: Use untracked `.env.local` files. A `DEFAULT_API_KEY` is provided for local-only development convenience but must be disabled in production environments.

## 6. Access Control Model
* **Scoped Access**: API keys must be bound to specific scopes (`verify`, `read`, `anchor`, `revoke`) as implemented in `trustsignal/apps/api/src/security.ts`.
* **Least Privilege**: GitHub App permissions should be restricted to the minimum required for the current MVP (Metadata: R, Contents: R, Actions: R, Checks: R&W).

## 7. Rotation Guidance
Rotation is currently handled as an manual operational procedure:
1. Generate new secret material.
2. Update the environment configuration in the deployment platform.
3. Redeploy the affected services to pick up the new configuration.
4. (Optional) For API keys, the `API_KEYS` environment variable supports a list of valid keys to facilitate graceful transition during rotation.

## 8. Revocation / Compromise Response
In the event of a suspected compromise:
* **API Keys**: Remove the compromised key from the `API_KEYS` environment variable and redeploy.
* **GitHub Secrets**: Rotate the secret in the GitHub App settings and update the corresponding environment variable.
* **Signing Keys**: Generate a new key pair and update the `current` signing configuration. Previously issued receipts remain verifiable if the public JWK is retained in the `verificationKeys` map.

## 9. Logging / Exposure Rules
* **Secret Masking**: `TrustSignal/github-actions/trustsignal-verify-artifact` must use `::add-mask::` for all secret inputs.
* **Sanitization**: Error handlers (e.g., `setFailed` in the GitHub Action) must redact 32+ character alphanumeric strings from error messages.
* **Header Redaction**: `Authorization` and `x-api-key` headers must be redacted in structured server logs.

## 10. Environment Separation
* **Local/Dev**: Uses ephemeral keys or dev-defaults. `trustsignal` core API uses a generated ephemeral Ed25519 key if no signing key is configured.
* **Production**: Requires explicit configuration of all secrets. Services should fail-closed and refuse to start if production secrets are missing or default keys are detected.

## 11. Current Constraints / Known Gaps
* The system does not currently implement automated rotation for receipt signing keys.
* Revocation issuer keys are managed via the `REVOCATION_ISSUERS` environment variable, requiring a redeploy for issuer updates.

## 12. Operational Recommendations
* Perform a quarterly review of active API keys and their assigned scopes.
* Ensure that the `PARTNER_SESSION_SECRET` is at least 32 characters long and unique to the production environment.
* Installation tokens must remain strictly in-memory; verify that no middleware or diagnostic tools accidentally persist these tokens.
