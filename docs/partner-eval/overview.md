# TrustSignal Partner Evaluation Overview

## Problem

Teams often have a workflow record that says an artifact was reviewed, approved, or submitted, but they cannot easily prove later that the same artifact is still the one tied to that decision.

## Integrity Model

TrustSignal is evidence integrity infrastructure. It acts as an integrity layer for existing workflows by accepting a verification request, returning verification signals, and issuing signed verification receipts with verifiable provenance metadata for later verification.

TrustSignal is designed to support:

- signed verification receipts
- verification signals
- verifiable provenance
- audit-ready evidence
- later verification without replacing the upstream workflow owner

## Integration Fit

TrustSignal fits behind an existing workflow such as:

- a partner portal
- a compliance evidence pipeline
- a deed or property-record workflow
- another intake system that already owns collection and review

The upstream platform remains the system of record. TrustSignal adds an integrity layer and returns technical verification artifacts that can be stored alongside the workflow record.

## Technical Detail

The public evaluation path in this repository is the `/api/v1/*` surface:

1. Submit a verification request to `POST /api/v1/verify`.
2. Receive a decision, signed verification receipt, and provenance metadata.
3. Retrieve the stored receipt at `GET /api/v1/receipt/{receiptId}`.
4. Run later verification at `POST /api/v1/receipt/{receiptId}/verify`.
5. Use authorized lifecycle actions such as revocation and provenance-state retrieval where needed.

Canonical contract and payload examples live in [openapi.yaml](/Users/christopher/Projects/trustsignal/openapi.yaml) and the [`examples/`](../../examples) directory.
