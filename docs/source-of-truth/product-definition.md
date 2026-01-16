# Product Definition: Deed Shield

> [!NOTE]
> This document was synthesized from codebase analysis (README, demo.md, architecture) to serve as a Source of Truth for documentation generation.

## Executive Summary
Deed Shield is a **B2B SaaS Verification Simulator** designed to integrity-check property document bundles before they are officially recorded. It provides an immutable-style receipt system that validates notary authority, document integrity, and jurisdictional metadata without permanently storing sensitive document contents.

## Core Value Proposition
- **Risk Reduction**: Validates notary credentials and document consistency before the "permanent record" is created.
- **Immutable Audit Trail**: Generates cryptographic receipts anchored to an EVM blockchain (Polygon Amoy), ensuring verification events cannot be retroactively altered.
- **Privacy-Preserving**: Operates on hashes and synthetic data; no PII or raw document content is exposed on-chain.

## Key Features
1.  **Ingestion & Verification**: Accepts PDF bundles and metadata (Jurisdiction, Notary ID, Document Type).
2.  **Notary Authority Check**: Simulates validation against a trusted registry of notary public credentials.
3.  **Cryptographic Receipting**: Emits a JSON receipt containing verification results, signed by the platform's key.
4.  **Blockchain Anchoring**: Periodically anchors receipt hashes to a public ledger (Polygon) to prove existence and integrity at a point in time.
5.  **Revocation System**: Allows for the revocation of widely issued receipts if a compromise is detected.

## Target Users
- **Title Companies**: To verify closing packets before submission.
- **County Recorders**: To automate pre-check validation of incoming filings.
- **Notaries (RON/IPEN)**: To self-verify bundles before applying final seals.

## Operational Status
Currently in **Pilot/Simulator Mode** validation. The system is configured to process **synthetic data only** and should not be used for live, legally binding real estate transactions without further configuration.
