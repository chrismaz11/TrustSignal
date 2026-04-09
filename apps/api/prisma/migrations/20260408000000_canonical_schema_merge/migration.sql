-- canonical_schema_merge
--
-- Purpose: reconcile Prisma schema with the actual database state.
--
-- 1. Drop legacy Prisma-managed auth tables superseded by Supabase api_keys.
-- 2. Add RegistrySource / RegistryCache / RegistryOracleJob (in schema, no prior migration).
-- 3. Add receiptSignature fields to Receipt (in schema, no prior migration).
--
-- All DDL is idempotent (IF NOT EXISTS / IF EXISTS).

-- ─── 1. Drop legacy tables ────────────────────────────────────────────────────
-- These were created by 20260317100000_restore_api_key_models.
-- Per DECISIONS.md, api_keys auth is owned by Supabase (public.api_keys / key_hash lookup).
-- "VerificationRecord" must be dropped first because it FK-references "ApiKey".

DROP TABLE IF EXISTS "VerificationRecord";
DROP TABLE IF EXISTS "ApiKey";

-- ─── 2. RegistrySource ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RegistrySource" (
    "id"                   TEXT         NOT NULL,
    "name"                 TEXT         NOT NULL,
    "category"             TEXT         NOT NULL,
    "endpoint"             TEXT         NOT NULL,
    "zkCircuit"            TEXT         NOT NULL,
    "active"               BOOLEAN      NOT NULL DEFAULT true,
    "freeTier"             BOOLEAN      NOT NULL DEFAULT true,
    "fetchIntervalMinutes" INTEGER      NOT NULL DEFAULT 1440,
    "parserVersion"        TEXT         NOT NULL DEFAULT 'v1',
    "lastFetchedAt"        TIMESTAMP(3),
    "lastSuccessAt"        TIMESTAMP(3),
    "lastError"            TEXT,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistrySource_pkey" PRIMARY KEY ("id")
);

-- ─── 3. RegistryCache ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RegistryCache" (
    "id"            TEXT         NOT NULL,
    "sourceId"      TEXT         NOT NULL,
    "subjectHash"   TEXT         NOT NULL,
    "responseJson"  TEXT         NOT NULL,
    "status"        TEXT         NOT NULL,
    "fetchedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt"     TIMESTAMP(3) NOT NULL,
    "sourceVersion" TEXT,

    CONSTRAINT "RegistryCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RegistryCache_sourceId_subjectHash_key"
    ON "RegistryCache"("sourceId", "subjectHash");

CREATE INDEX IF NOT EXISTS "RegistryCache_expiresAt_idx"
    ON "RegistryCache"("expiresAt");

ALTER TABLE "RegistryCache"
    ADD CONSTRAINT "RegistryCache_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "RegistrySource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
    NOT VALID;  -- validate separately to avoid lock on large tables

-- ─── 4. RegistryOracleJob ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "RegistryOracleJob" (
    "id"              TEXT         NOT NULL,
    "sourceId"        TEXT         NOT NULL,
    "subjectHash"     TEXT         NOT NULL,
    "zkCircuit"       TEXT         NOT NULL,
    "inputCommitment" TEXT         NOT NULL,
    "status"          TEXT         NOT NULL,
    "resultStatus"    TEXT,
    "proofUri"        TEXT,
    "error"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"     TIMESTAMP(3),

    CONSTRAINT "RegistryOracleJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RegistryOracleJob_sourceId_createdAt_idx"
    ON "RegistryOracleJob"("sourceId", "createdAt");

CREATE INDEX IF NOT EXISTS "RegistryOracleJob_status_idx"
    ON "RegistryOracleJob"("status");

ALTER TABLE "RegistryOracleJob"
    ADD CONSTRAINT "RegistryOracleJob_sourceId_fkey"
    FOREIGN KEY ("sourceId") REFERENCES "RegistrySource"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
    NOT VALID;

-- ─── 5. Receipt — add signature fields ────────────────────────────────────────

ALTER TABLE "Receipt"
    ADD COLUMN IF NOT EXISTS "receiptSignature"    TEXT,
    ADD COLUMN IF NOT EXISTS "receiptSignatureAlg" TEXT,
    ADD COLUMN IF NOT EXISTS "receiptSignatureKid" TEXT;
