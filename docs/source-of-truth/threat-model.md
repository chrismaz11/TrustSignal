# Threat Model & Security Posture

> [!NOTE]
> This document was synthesized from codebase analysis to serve as a Source of Truth.

## 1. Data Privacy & Handling
- **No PII Persistence**: The system is designed to ingest document bundles, extract cryptographic hashes, and discard the raw content. It does not act as a permanent record store.
- **Synthetic Constraint**: Currently, verify operations are limited to **synthetic data** to eliminate risk of real-world PII leakage during pilot phases.
- **Local Key Management**: Issuer keys are stored as file-based JWKs on the server filesystem, not in the database.

## 2. Integrity & Verification
- **Hash-Based Integrity**: Document integrity is verified via SHA-256 (or similar) canonical hashing. The system does not "read" the document text for semantic meaning, but rather verifies bit-for-bit fidelity.
- **Registry Trust**: Notary authority is derived from a trusted registry. If the registry is compromised or spoofed, verification results are invalid. The system enforces registry signatures to mitigate this.
- **Receipt Immutability**: Once a receipt is issued and anchored, its hash is part of the public chain history. Altering a past receipt would require breaking the chain's cryptographic consensus.

## 3. Attack Surface & Mitigations
| Threat | Mitigation |
| :--- | :--- |
| **Spoofed Notary** | Validation against a cryptographically secured Notary Registry. |
| **Tampered Receipt** | Client-side re-hashing execution and on-chain anchor verification. |
| **Database Corruption** | Anchoring limits reliance on the local SQL database; truth is on-chain. |
| **Key Theft** | Keys are isolated from the DB; projected move to HSM for production. |

## 4. Known Liabilities (Pilot Phase)
- **Centralized Oracle**: The current "Issuer" is a centralized service. Trust is currently placed in the Deed Shield operator.
- **Availability**: Reliance on Polygon Amoy testnet means anchoring may pause if the testnet is unstable.
- **Subprocessors**: Reliance on third-party cloud and blockchain node providers introduces supply chain risk (outages, data residency).
