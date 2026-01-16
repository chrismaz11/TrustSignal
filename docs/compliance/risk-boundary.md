# Risk & Responsibility Boundary Statement

**Version:** 1.0.0
**Date:** 2026-01-16

---

## 1. Purpose
To maintain the integrity of our pilot, we must clearly define the boundaries of what Deed Shield **IS** and what it **IS NOT**.

## 2. What Deed Shield IS
- **A Technical Validator:** We check mathematical properties: (a) Is the PDF hash unchanged? (b) Is the Notary ID in our allowed list? (c) Is the signature valid?
- **An Audit Trail Generator:** We create immutable evidence that a verification check occurred.

## 3. What Deed Shield IS NOT (Hard Boundaries)
- **NOT a Legal Reviewer:** We do not read the deed. We do not check if the legal description is accurate or if the grantor actually owns the property.
- **NOT an Identity Provider:** We verify the *Notary's* authority. We do not verify the *Signer's* biometric identity directly. That is the Notary's job.
- **NOT a Custodian of Record:** We do not store the "original" deed. If you lose your PDF, we cannot recover it for you. We only have the hash.

## 4. Operational Risk Allocation
- **User Risk:** You bear the risk of ensuring the input document is the correct version.
- **Platform Risk:** We accept the risk of maintaining the integrity of the receipt generation service and the anchor link.

---
*Change Log:*
- *v1.0.0: Initial generation based on Legal Positions & Product Definition (Source of Truth).*
