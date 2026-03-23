# Privacy Policy

**Version:** 2.0
**Effective Date:** 2026-02-25

## 1. Purpose
This Privacy Policy describes how TrustSignal ("we", "us", "our") handles data when customers use our verification services.

## 2. Scope
This policy applies to:
- TrustSignal APIs and web applications
- TrustSignal pilot and pre-production verification workflows
- related support and operational services

## 3. Data Categories
We may process the following categories of data:
- Account and access data (for example, user identifiers and API credentials)
- Verification metadata (for example, timestamps and technical verification context)
- Cryptographic artifacts (for example, document and receipt hashes)
- Operational and security logs (for example, request metadata and service events)

## 4. Processing Model
TrustSignal is designed around data minimization:
- Verification workloads are intended to process document content ephemerally.
- Long-term records focus on receipts and metadata needed for auditability and support.
- Hash-based evidence may be used for tamper-evident verification and audit workflows.

## 5. Blockchain Anchoring
Where anchoring is enabled:
- only non-PII cryptographic artifacts should be anchored
- blockchain records are public and generally immutable
- anchored records cannot typically be deleted from public ledgers

## 6. Retention and Deletion
Retention periods are determined by service tier, legal obligations, and contractual requirements. Baseline operational targets are:
- transient upload content: minimal retention aligned with processing needs
- verification records and receipts: retained for audit and support needs
- operational logs: retained for security and reliability operations

Deletion and export requests are handled according to contractual terms and technical constraints (including immutable public ledger constraints where applicable).

## 7. Security and Access Controls
We apply administrative, technical, and organizational controls intended to protect data, including least-privilege access, encrypted transport paths, and environment-based secret management.

## 8. Subprocessors and Infrastructure Providers
We may use third-party infrastructure providers for hosting, monitoring, and network services. Provider details are supplied through customer onboarding materials and contractual documentation.

## 9. Regulatory and Compliance Position
This policy describes operational data practices and is not a standalone certification statement. We do not claim sector-specific regulatory compliance unless explicitly agreed in a separate signed agreement.

## 10. Policy Updates
We may update this policy from time to time. The version and effective date at the top of this document indicate the current edition.
