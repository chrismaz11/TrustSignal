# DB Security Evidence Collection

This runbook captures the evidence required to close Workstream `#3`:
- PostgreSQL in use
- TLS required for DB connections
- Encryption at rest enabled for staging/production DB

## Prerequisites
- Valid AWS credentials/session (if using AWS RDS/Aurora).
- `DATABASE_URL` for the target environment.
- `sslmode=require` (or stronger) in `DATABASE_URL`.

## Generate Evidence Bundle
From `Deed_Shield/`:

```bash
DATABASE_URL='postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require' \
node scripts/capture-db-security-evidence.mjs \
  --environment staging \
  --db-instance-id <rds-instance-id>
```

For Aurora:

```bash
DATABASE_URL='postgresql://<user>:<password>@<host>:5432/<db>?sslmode=require' \
node scripts/capture-db-security-evidence.mjs \
  --environment staging \
  --db-cluster-id <aurora-cluster-id>
```

Output is written to:
- `docs/evidence/db-security/<environment>-<timestamp>.md`

## Required Passing Signals
- Prisma datasource provider is `postgresql`.
- Migration lock provider is `postgresql`.
- Baseline Postgres migration exists.
- `DATABASE_URL` protocol is Postgres and `sslmode` is `require|verify-ca|verify-full`.
- `prisma migrate status` succeeds.
- AWS evidence confirms `StorageEncrypted: true`.
- Parameter group evidence confirms DB TLS enforcement (e.g. `rds.force_ssl=1` when applicable).

## Attach to Governance Tracker
When the bundle is generated from staging/prod credentials:
1. Link the evidence file in `docs/PRODUCTION_GOVERNANCE_TRACKER.md` Workstream `#3`.
2. Record command date/time and operator.
3. Mark status as `VERIFIED IN STAGING` only after staging checks pass.
