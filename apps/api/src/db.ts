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
      "fraudRisk" TEXT,
      "zkpAttestation" TEXT,
      "revoked" BOOLEAN NOT NULL DEFAULT FALSE
    )`,
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
    )`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
}
