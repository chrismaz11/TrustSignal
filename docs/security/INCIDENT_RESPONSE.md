# Incident Response

## 1. Executive Summary
This document provides practical playbooks for responding to security and integrity incidents within the TrustSignal product suite. Our goal is to contain threats quickly, preserve evidence for root-cause analysis, and restore system integrity with minimal disruption to partners.

## 2. Incident Handling Principles
*   **Containment First**: Prioritize stopping the leak or blocking the attacker over finding the root cause.
*   **Evidence Preservation**: Avoid destructive actions (e.g., deleting logs) during the initial response.
*   **Pragmatic Communication**: Provide clear, accurate updates to partners based on verified facts, not speculation.
*   **Fail-Closed**: If integrity is uncertain, the system should default to a secure, non-operational state.

## 3. Severity Model

| Severity | Description | Target Response |
| :--- | :--- | :--- |
| **Critical** | Potential compromise of signing keys or total loss of integrity. | Immediate (Founder/Engineering) |
| **High** | Compromise of an API key with `verify` or `revoke` scopes. | < 4 hours |
| **Medium** | Suspected webhook replay or unauthorized demo access. | Same business day |
| **Low** | Log hygiene issues or non-critical configuration drift. | Next development cycle |

## 4. Roles and Responsibilities
*   **Primary Operator (Founder)**: Final decision maker on high-impact actions (e.g., rotating root signing keys).
*   **Engineering Owner**: Technical lead for containment, fix implementation, and forensic analysis.
*   **Partner Contact**: Coordinates communication with affected integration partners.

## 5. Incident Categories
1. Leaked API key
2. Leaked webhook secret
3. Compromised GitHub App private key
4. Suspicious receipt mismatch
5. Unexpected public data exposure
6. Partner demo route exposure
7. Webhook replay or event abuse
8. CI/CD secret leakage
9. Signing key compromise

## 6. Per-Incident Playbooks

### Playbook 1: Leaked API Key
*   **Detection**: Discovered in public logs, CI output, or reported by a partner.
*   **Containment**: Remove the leaked key from the `API_KEYS` environment variable.
*   **Validation**: Check logs for unauthorized calls made using the key's hash.
*   **Recovery**: Issue a new key to the affected service/partner and redeploy.

### Playbook 2: Leaked Webhook Secret
*   **Detection**: GitHub notifies of a secret leak, or unauthorized webhooks are detected.
*   **Immediate Containment**: Generate a new secret in GitHub App settings.
*   **Recovery**: Update the `GITHUB_WEBHOOK_SECRET` environment variable and redeploy `TrustSignal-App`.
*   **Follow-up**: Review recent `workflow_run` events for suspicious activity.

### Playbook 3: Signing Key Compromise
*   **Detection**: Receipt verification fails for newly issued receipts, or keys are found in an insecure location.
*   **Containment**: Generate a new Ed25519 key pair.
*   **Recovery**: Update the `current` key in `SecurityConfig` and move the old key to the `verificationKeys` map if still needed for older receipts.
*   **Validation**: Re-verify a sample of recently issued receipts to ensure the new key is active.

### Playbook 4: Suspicious Receipt Mismatch
*   **Detection**: `POST /api/v1/receipt/:id/verify` returns `verified: false` unexpectedly.
*   **Action**: Determine if the mismatch is due to legitimate artifact drift or potential tampering.
*   **Validation**: Compare the `recomputedHash` against the `storedHash` in the verification response.
*   **Forensics**: Check CI/CD logs for the original artifact build metadata.

## 7. Evidence Preservation Guidance
*   **Logs**: Capture and store 24 hours of logs from the affected service.
*   **Git History**: If secrets were committed, use `git filter-repo` (or similar) to purge them only AFTER the incident is contained and rotated.
*   **Database**: Take a snapshot of the `ArtifactReceipt` table if tampering is suspected.

## 8. Communication Guidance
*   **Internal**: Use a dedicated, private channel for coordination.
*   **Partners**: Notify affected partners within 24 hours of a confirmed compromise. Use the template: *"We have detected a security incident affecting [Scope]. We have [Action Taken] and recommend [Partner Action]."*

## 9. Post-Incident Review Template
1. Summary of incident
2. Timeline (Detection, Containment, Resolution)
3. Root cause
4. Impact assessment
5. Lessons learned
6. Preventive actions for the next cycle

## 10. Known Constraints for a Small Team
*   No dedicated security team; response is handled by core engineering.
*   Limited forensic tooling; rely on platform-native logs (Vercel, GitHub).
*   Prioritize manual rotation and redeploy as the primary recovery mechanism.
