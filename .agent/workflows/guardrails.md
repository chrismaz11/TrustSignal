---
description:
---

Set explicit “do nots”:

No creation or use of src/api/verify.js or any legacy raw‑sqlite, shell‑driven DB code; all work must go through the Fastify + Prisma stack in apps/api/src/server.ts.

No new endpoints without:

Auth,

Schema validation,

Logging/audit decisions mapped to the models in schema.prisma.

No secrets, private keys, or .env examples committed or suggested; all secrets must be assumed to live in a vault and be wired through env vars as documented.
