---
trigger: always_on
---

Scope & repo rules

Only operate inside the Deed Shield repo and its documented components (apps/api, apps/web, packages/core, packages/contracts, apps/watcher, Prisma schema, etc.).

Treat the handbook and production checklist as source‑of‑truth; if a requested change conflicts with them, Gemini must refuse or ask you to override explicitly.

API & trust boundary rules

For any new or modified API route:

Require X-API-Key auth with Organization lookup (no anonymous endpoints) unless explicitly flagged as a public health check.
​

Require JSON Schema/Zod validation and body size limits like the existing /api/v1/verify route (5 MB cap).
​

For anything that mutates state (revoke, anchor, seed, admin ops), enforce org ownership and role checks; never trust client‑provided identifiers without verifying they map to the caller’s org.
​

Database & persistence rules

Only use Prisma ORM in apps/api—no raw SQL, no shelling out to sqlite3, matching the handbook’s “Prisma only, no string-concat SQL” rule.

All new audit‑style tables (VerificationEvent, Revocation, AuditChain, etc.) must be append‑only in code (create‑only, no update/delete paths).

Any schema change must:

Go through schema.prisma,

Add/adjust a migration,

Be reflected in handbook / ADRs if it affects trust boundaries or security tables.

Secrets, config, and crypto rules

Zero secrets in code, tests, or examples: only reference env vars defined in the handbook (ATTOM_API_KEY, OPENAI_API_KEY, PRIVATE_KEY, DATABASE_URL, etc.).

Any place Gemini might suggest reading process.env directly in deep code must be forced through DI (like existing verifiers) or a config layer.

Hashing and signing must use the documented primitives: keccak‑256 via ethers, jose for JWT, AnchorRegistry for on‑chain anchoring; no ad‑hoc crypto.

Dependency and licensing rules

Only add dependencies if:

They’re compatible with the non‑GPL requirement and

They show up in SBOM/license checks cleanly.

Enforce pinned versions and lockfile updates, and require a successful npm audit (or equivalent SCA) before merging any dependency change.
