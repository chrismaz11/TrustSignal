import { PrismaClient } from '@prisma/client';

export async function ensureDatabase(prisma: PrismaClient) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS "Receipt" (
      "id" TEXT PRIMARY KEY,
      "receiptHash" TEXT NOT NULL,
      "inputsCommitment" TEXT NOT NULL,
      "policyProfile" TEXT NOT NULL,
      "parcelId" TEXT,
      "decision" TEXT NOT NULL,
      "reasons" TEXT NOT NULL,
      "riskScore" INTEGER NOT NULL,
      "checks" TEXT NOT NULL,
      "rawInputsHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "anchorStatus" TEXT NOT NULL DEFAULT 'PENDING',
      "anchorTxHash" TEXT,
      "anchorChainId" TEXT,
      "anchorId" TEXT,
      "anchorSubjectDigest" TEXT,
      "anchorSubjectVersion" TEXT,
      "anchorAnchoredAt" TIMESTAMP(3),
      "fraudRisk" TEXT,
      "zkpAttestation" TEXT,
      "receiptSignature" TEXT,
      "receiptSignatureAlg" TEXT,
      "receiptSignatureKid" TEXT,
      "revoked" BOOLEAN NOT NULL DEFAULT FALSE
    )`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "anchorSubjectDigest" TEXT`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "anchorSubjectVersion" TEXT`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "anchorAnchoredAt" TIMESTAMP(3)`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "receiptSignature" TEXT`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "receiptSignatureAlg" TEXT`,
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "receiptSignatureKid" TEXT`,
    `CREATE TABLE IF NOT EXISTS "Property" (
      "parcelId" TEXT PRIMARY KEY,
      "currentOwner" TEXT NOT NULL,
      "lastSaleDate" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "CountyRecord" (
      "parcelId" TEXT PRIMARY KEY,
      "county" TEXT NOT NULL,
      "state" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT TRUE
    )`,
    `CREATE TABLE IF NOT EXISTS "Notary" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "commissionState" TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "RegistrySource" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "endpoint" TEXT NOT NULL,
      "zkCircuit" TEXT NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT TRUE,
      "freeTier" BOOLEAN NOT NULL DEFAULT TRUE,
      "fetchIntervalMinutes" INTEGER NOT NULL DEFAULT 1440,
      "parserVersion" TEXT NOT NULL DEFAULT 'v1',
      "lastFetchedAt" TIMESTAMP(3),
      "lastSuccessAt" TIMESTAMP(3),
      "lastError" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "RegistryCache" (
      "id" TEXT PRIMARY KEY,
      "sourceId" TEXT NOT NULL REFERENCES "RegistrySource"("id") ON DELETE CASCADE,
      "subjectHash" TEXT NOT NULL,
      "responseJson" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "sourceVersion" TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS "RegistryOracleJob" (
      "id" TEXT PRIMARY KEY,
      "sourceId" TEXT NOT NULL REFERENCES "RegistrySource"("id") ON DELETE CASCADE,
      "subjectHash" TEXT NOT NULL,
      "zkCircuit" TEXT NOT NULL,
      "inputCommitment" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "resultStatus" TEXT,
      "proofUri" TEXT,
      "error" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "RegistryCache_sourceId_subjectHash_key"
      ON "RegistryCache" ("sourceId", "subjectHash")`,
    `CREATE INDEX IF NOT EXISTS "RegistryCache_expiresAt_idx"
      ON "RegistryCache" ("expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "RegistryCache_sourceId_idx"
      ON "RegistryCache" ("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "RegistryOracleJob_sourceId_createdAt_idx"
      ON "RegistryOracleJob" ("sourceId", "createdAt")`,
    `CREATE INDEX IF NOT EXISTS "RegistryOracleJob_status_idx"
      ON "RegistryOracleJob" ("status")`,
    `CREATE INDEX IF NOT EXISTS "RegistrySource_active_idx"
      ON "RegistrySource" ("active")`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
}
