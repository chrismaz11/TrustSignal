# TrustSignal Canonical Decisions

This file is the source of truth for pilot-boundary implementation choices. If code, docs, or another repo disagree with this file, this file wins and the drift should be removed.

## Canonical stack

1. The canonical verification API is `TrustSignal/apps/api`.
2. The canonical public frontend is `v0-signal-new`, which is the live source for `trustsignal.dev`.
3. `TrustSignal-App` is the GitHub App backend only. It is not a second public API.
4. The canonical GitHub Action is `TrustSignal/github-actions/trustsignal-verify-artifact`.
5. The standalone `TrustSignal-Verify-Artifact` repo is deprecated and should remain archived only for history.
6. `TrustSignal/apps/web` is not a pilot production surface.

## Auth and database

1. API keys are stored only as SHA-256 hashes in Supabase/Postgres `public.api_keys`.
2. `TRUSTSIGNAL_API_KEY` remains the client secret name, not a separate auth system.
3. Production auth does not depend on `API_KEYS` or `API_KEY_SCOPES` env allowlists.
4. Prisma `ApiKey` and `VerificationRecord` are not part of the canonical active model.
5. Supabase/Postgres is the source of truth for accounts, API keys, verification logs, and receipts.
6. Schema changes happen through migrations only. API startup must not create or mutate schema.

## Receipt lifecycle

1. `POST /api/v1/verify` remains the canonical verification entrypoint.
2. `POST /api/v1/verifications/github` is a GitHub-specific adapter over the same receipt issuance path.
3. `GET /api/v1/receipt/{id}`, `POST /api/v1/receipt/{id}/verify`, `POST /api/v1/receipt/{id}/revoke`, and `POST /api/v1/anchor/{id}` are the pilot lifecycle routes.
4. Public status language is frozen to `clean`, `failure`, `revoked`, and `compliance_gap`.

## Scope controls

1. OAuth, Stripe, customer self-serve key UI, native Vanta/Drata integrations, production ZK proofs, and Solana anchoring are not phase-1 pilot blockers.
2. Internal operator tooling ships before customer self-serve.
