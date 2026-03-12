**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# TrustSignal Wiki

TrustSignal provides signed receipts and verifiable provenance for compliance artifacts. It is an integrity layer for existing workflows, not a replacement for the system of record.

This wiki is written for engineers, technical evaluators, and partner reviewers who need to understand what TrustSignal does, where it fits, and how to integrate with it without exposing private verification-engine details.

## Start Here

- [What is TrustSignal](What-is-TrustSignal)
- [Evidence Integrity Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [SDK Usage](SDK-Usage)
- [Vanta Integration Example](Vanta-Integration-Example)
- [Security Model](Security-Model)
- [Threat Model](Threat-Model)
- [FAQ](FAQ)

## Documentation Scope

This wiki covers:

- product positioning and integration model
- public API surfaces
- receipt lifecycle behavior
- SDK usage
- partner-facing security expectations
- threat-model framing for external reviewers

This wiki does not document:

- proof internals
- model internals
- private scoring logic
- signing infrastructure implementation details
- internal service topology

## Key Ideas

- TrustSignal accepts a verification request from an existing workflow.
- TrustSignal returns a signed verification receipt with stable identifiers.
- That receipt can be retrieved, checked, and attached to downstream audit or compliance workflows.
- TrustSignal can also produce normalized evidence payloads for systems such as Vanta.

If you want to see the smallest end-to-end payload example first, start with [Quick Verification Example](Quick-Verification-Example).

## Website

- https://trustsignal.dev

## Claims Boundary

TrustSignal provides technical verification signals, not legal determinations. Public-facing descriptions should avoid claiming completed compliance certification, completed production hardening in every environment, or guarantees that depend on private infrastructure evidence.
