# TrustSignal Compliance Evidence Boundary

> TrustSignal separates public readiness documentation from private compliance evidence. The public repository must remain limited to high-level documentation and placeholders.

## Public Repo

- policy templates
- high-level control descriptions
- readiness checklist
- compliance overview
- generated public-safe readiness summaries

## Private Systems

- operational evidence
- access review logs
- security incident reports
- infrastructure diagrams
- monitoring dashboards
- vulnerability evidence and remediation records
- vendor contracts and due diligence records

## Storage Expectation

Real audit evidence should be stored in:

- Vanta
- internal compliance storage
- private audit repository

## Rule

Do not place sensitive operational evidence in this repository. If a public compliance file needs to reference evidence, it should point to the private system of record rather than copying the evidence into git.
