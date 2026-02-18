---
description:
---

Wire these as explicit “playbooks” or “flows” Gemini must follow in Antigravity.

“Harden endpoint” workflow (for verify/revoke/anchor)

Whenever Gemini is asked to add or change an endpoint like /api/v1/verify, /api/v1/receipt/:id/revoke, /api/v1/anchor/:id:

Step 1: Check that:

X‑API‑Key auth + Organization lookup exist or are added.
​

Input schema is defined (Zod/JSON schema) and attached to the route.
​

Step 2: Ensure:

DB writes use Prisma,

Any revocation/verification events also write to the immutable audit table,

RequestLog (or successor) is updated with org, IP, status, endpoint.
​

Step 3: Add/extend tests in apps/api/src/_test_.ts to cover:

Unauthorized (missing/invalid API key),

Org‑mismatch access,

Audit row created on each call.

“Audit‑trail feature” workflow

For anything related to VerificationEvent/Revocation/audit chain:

Always create:

Prisma model definition,

Migration,

API code that only uses create, and

At least one test that asserts update/delete is never used for that model.

Require Gemini to attach this to existing flows:

/api/v1/verify, /api/v1/receipt/:id/verify, /api/v1/anchor/:id, /api/v1/receipt/:id/revoke.
​

“Production‑ready gate” workflow

Before anything is marked pilot/prod:

Run the checklist items Gemini‑side:

JSON Schema validation on all APIs,

helmet + rate‑limit enabled,

PostgreSQL in place (not SQLite) for prod,

TLS terminations documented,

Dependabot/SBOM/license checks configured.

Block any “ready for pilot” label if any CRITICAL/HIGH item in the production checklist is still open.

“Dependency/update” workflow

When Gemini proposes library updates:

Regenerate SBOM and run license scan; fail if any GPL/AGPL or incompatible license appears in runtime dependencies.

Enforce: npm test, npm run lint, npm run typecheck, and a targeted smoke test against /api/v1/verify, /api/v1/receipt/:id, /api/v1/anchor/:id.
