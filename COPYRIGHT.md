# Copyright and Ownership Policy

This repository is maintained as proprietary TrustSignal software and documentation.

## Intended Ownership Model

- TrustSignal-owned repository materials are intended to be owned by TrustSignal, subject to any third-party licenses, contractor agreements, employment agreements, or other written assignment terms that apply to a specific contribution.
- No file in this repository should be treated as a clean TrustSignal-owned registration candidate if its provenance, assignment status, or license status is unclear.
- Third-party code, third-party assets, vendor files, and separately licensed files are not claimed as exclusively owned by TrustSignal merely because they appear in this repository.

## Repository Consistency Rules

- Root ownership and license notices must remain consistent with the proprietary repository license in [`LICENSE`](LICENSE).
- File-level license headers that conflict with the repository ownership position must be reviewed deliberately and documented before they are included in any ownership or registration claim.
- If a contribution was created with material AI assistance, external templates, copied snippets, contractor input, or third-party source material, that provenance must be recorded before the file is treated as a registration candidate.

## Registration Candidate Exclusions

The following categories are excluded from the initial copyright registration candidate set unless specifically reviewed and approved:

- generated artifacts and caches, including `dist/`, `.next/`, `artifacts/`, `cache/`, `target/`, and `*.tsbuildinfo`
- vendor-managed dependencies and environments, including `node_modules/`, `.venv/`, and deployment metadata directories such as `.vercel/`
- sample documents, sample PDFs, watched-folder examples, and other provenance-unclear input artifacts
- secrets, private keys, credentials, environment files, and security-sensitive configuration values
- generated screenshots, demo output, benchmark output, and files under `output/`

## Provenance Tracking

- High-value registration candidates should be listed in a provenance ledger before registration review.
- The initial TrustSignal registration bundle should be limited to a small set of core source files with the strongest authorship and ownership record.

## Open License Decision

- [`packages/contracts/contracts/AnchorRegistry.sol`](packages/contracts/contracts/AnchorRegistry.sol) currently carries an `Apache-2.0` SPDX header.
- That file must be treated as a deliberate license-decision item and excluded from the initial proprietary registration bundle until its licensing intent is explicitly resolved.

## Notices and Attribution

- If you add third-party code or assets, include any required attribution or notice material in [`NOTICE`](NOTICE) or in file-level notices as appropriate.
- Do not remove or alter third-party license notices without confirming the applicable license obligations.
