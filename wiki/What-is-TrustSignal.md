**Navigation**

- [Home](Home)
- [What is TrustSignal](What-is-TrustSignal)
- [Architecture](Evidence-Integrity-Architecture)
- [Verification Receipts](Verification-Receipts)
- [API Overview](API-Overview)
- [Claims Boundary](Claims-Boundary)
- [Quick Verification Example](Quick-Verification-Example)
- [Vanta Integration Example](Vanta-Integration-Example)

# What Is TrustSignal

TrustSignal is evidence integrity infrastructure for compliance artifacts. It issues signed verification receipts and preserves the information needed to later confirm that a verification result still corresponds to the artifact and policy context originally evaluated.

## What It Does

TrustSignal helps teams:

- create signed receipts when evidence is evaluated
- retrieve those receipts later for audit, review, or partner workflows
- re-verify stored receipts without depending on screenshots or manual notes
- export normalized evidence payloads for downstream systems

## Where It Fits

TrustSignal fits behind an existing platform such as:

- a compliance operations system
- an evidence collection workflow
- a partner portal
- a vertical workflow such as deed verification

The upstream platform remains the system of record. TrustSignal adds integrity evidence at the boundary.

## Verification Model

At a product level, the model is straightforward:

1. An upstream system submits a verification request or artifact reference.
2. TrustSignal evaluates the request against the configured policy and data dependencies.
3. TrustSignal returns a decision plus a signed verification receipt.
4. Downstream systems use the receipt as a stable audit artifact.
5. Later checks can confirm receipt integrity, status, and lifecycle state.

In the current codebase, the integration-facing `/api/v1/*` routes implement that model by validating requests in the gateway and delegating the major lifecycle actions to the engine interface.

## What TrustSignal Is Not

TrustSignal is not:

- a replacement for compliance workflow software
- a legal decision engine
- a guarantee that an upstream source system is correct
- a substitute for environment-specific security evidence or control validation

## Current Repository Context

This repository currently exposes:

- the integration-facing `/api/v1/*` API surface
- the legacy `/v1/*` API surface used by the JavaScript SDK
- the DeedShield application module as the current product surface in-repo

The product framing remains broader than a single module: TrustSignal is the integrity layer that sits behind workflow-specific applications.
