# TrustSignal Documentation Architecture

> TrustSignal is evidence integrity infrastructure for signed verification receipts and later verification.

This guide defines the canonical information architecture for TrustSignal documentation. It is designed for GitHub markdown today and for later mirroring into website documentation with minimal restructuring.

## Purpose

TrustSignal documentation should make it easy to understand:

- what TrustSignal is
- how the integrity layer fits into existing workflow integration
- how signed verification receipts, verification signals, verifiable provenance, and later verification relate to one another
- where evaluators, developers, and partner reviewers should start
- what claims are in scope and what remains outside the public boundary

## Canonical Sections

### 1. Overview / Start Here

Audience:
- new evaluators
- partner reviewers
- developers new to the repository

Content:
- product-level orientation
- short repository description
- start-here navigation
- reading order for first-time readers
- high-level explanation of existing workflow integration

Examples:
- `README.md`
- `docs/README.md`
- `docs/partner-eval/start-here.md`
- `wiki/Home.md`

### 2. Core Concepts

Audience:
- evaluators
- product and partnership stakeholders
- developers who need the terminology before the API details

Content:
- evidence integrity infrastructure
- integrity layer positioning
- signed verification receipts
- verification signals
- verifiable provenance
- later verification
- existing workflow integration framing

Examples:
- `wiki/What-is-TrustSignal.md`
- `wiki/Verification-Receipts.md`

### 3. Verification Lifecycle

Audience:
- evaluators
- implementation owners
- security reviewers

Content:
- lifecycle diagrams
- step-by-step explanations
- trust boundary framing
- how the receipt lifecycle works from request through later verification

Examples:
- `docs/verification-lifecycle.md`
- `wiki/Quick-Verification-Example.md`

### 4. API and Examples

Audience:
- developers
- integration engineers
- technical evaluators

Content:
- public endpoint overview
- request and response examples
- auth expectations
- lifecycle actions
- error semantics

Examples:
- `openapi.yaml`
- `docs/partner-eval/try-the-api.md`
- `wiki/API-Overview.md`

### 5. Security and Threat Model

Audience:
- security reviewers
- partner security teams
- technical decision-makers

Content:
- public-safe security posture
- security controls at the integration boundary
- what is intentionally not exposed
- threat model links
- production security considerations

Examples:
- `docs/security-summary.md`
- `docs/partner-eval/security-summary.md`
- `SECURITY_CHECKLIST.md`
- `docs/SECURITY.md`

### 6. Benchmarks and Evaluator Materials

Audience:
- evaluators
- partner technical reviewers
- internal teams validating performance snapshots

Content:
- benchmark methodology
- benchmark metadata
- scenario coverage
- local benchmark caveats
- links to raw artifacts

Examples:
- `bench/README.md`
- `docs/partner-eval/benchmark-summary.md`
- `bench/results/latest.md`

### 7. Partner Evaluation

Audience:
- partner evaluators
- solutions engineers
- technical sponsors

Content:
- overview of evaluator path
- benchmark summary
- security summary
- quickstart links
- integration briefing materials

Examples:
- `docs/partner-eval/overview.md`
- `docs/partner-eval/try-the-api.md`
- `docs/partner-eval/benchmark-summary.md`

### 8. Claims Boundary

Audience:
- partner reviewers
- legal/compliance-adjacent reviewers
- internal authors of public docs

Content:
- what TrustSignal does claim
- what TrustSignal does not claim
- phrasing guardrails
- public/private boundary references

Examples:
- `wiki/Claims-Boundary.md`
- `docs/public-private-boundary.md`
- `README.md` claims sections

### 9. Reference / Related Docs

Audience:
- all readers once they need depth

Content:
- related document lists
- archival references
- legal, policy, and operational references
- specialized evaluator materials

Examples:
- `docs/README.md`
- related documentation sections across public docs

## Linking Model

TrustSignal docs should link in layers:

1. Overview documents link down into lifecycle, API, security, benchmarks, and claims boundary.
2. Concept and lifecycle docs link sideways to API examples, security summaries, and evaluator materials.
3. Deep technical or evaluator docs link back up to overview/start-here pages so readers do not dead-end.

Preferred link behavior:

- Every public-facing doc should end with a `Related Documentation` section.
- API docs should link to lifecycle, evaluator overview, and claims boundary.
- Security docs should link to claims boundary and public-safe architecture docs.
- Benchmark docs should link to evaluator overview, API trial docs, and raw benchmark artifacts.

## Preferred Reading Order

### Evaluator Reading Order

1. `README.md`
2. `docs/partner-eval/overview.md`
3. `docs/verification-lifecycle.md`
4. `docs/partner-eval/try-the-api.md`
5. `docs/partner-eval/benchmark-summary.md`
6. `docs/partner-eval/security-summary.md`
7. `wiki/Claims-Boundary.md`

### Developer Reading Order

1. `README.md`
2. `docs/README.md`
3. `docs/verification-lifecycle.md`
4. `wiki/API-Overview.md`
5. `docs/partner-eval/try-the-api.md`
6. `docs/security-summary.md`
7. `bench/README.md`

## Authoring Rules

- Lead with a short description and audience label where useful.
- Use the canonical TrustSignal phrases consistently:
  - evidence integrity infrastructure
  - signed verification receipts
  - verification signals
  - verifiable provenance
  - later verification
  - integrity layer
  - existing workflow integration
- Keep GitHub-markdown-friendly structure.
- Do not expose internal proof systems, circuit identifiers, model outputs, signing infrastructure specifics, internal service topology, witness/prover details, or registry scoring algorithms.
- Do not force identical headings into every file when the result would reduce clarity. Use the common structure intelligently.
