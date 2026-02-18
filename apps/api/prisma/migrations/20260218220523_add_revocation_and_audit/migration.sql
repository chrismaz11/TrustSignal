-- CreateTable
CREATE TABLE "Revocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "revokedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedBy" TEXT NOT NULL,
    CONSTRAINT "Revocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Revocation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endpoint" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "receiptId" TEXT,
    "organizationId" TEXT,
    CONSTRAINT "VerificationEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "receiptId" TEXT,
    "status" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Receipt" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptHash" TEXT NOT NULL,
    "inputsCommitment" TEXT NOT NULL,
    "policyProfile" TEXT NOT NULL,
    "parcelId" TEXT,
    "decision" TEXT NOT NULL,
    "reasons" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL,
    "checks" TEXT NOT NULL,
    "rawInputs" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anchorStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "anchorTxHash" TEXT,
    "anchorChainId" TEXT,
    "anchorId" TEXT,
    "fraudRisk" TEXT,
    "zkpAttestation" TEXT,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT,
    CONSTRAINT "Receipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("anchorChainId", "anchorId", "anchorStatus", "anchorTxHash", "checks", "createdAt", "decision", "fraudRisk", "id", "inputsCommitment", "parcelId", "policyProfile", "rawInputs", "reasons", "receiptHash", "revoked", "riskScore", "zkpAttestation") SELECT "anchorChainId", "anchorId", "anchorStatus", "anchorTxHash", "checks", "createdAt", "decision", "fraudRisk", "id", "inputsCommitment", "parcelId", "policyProfile", "rawInputs", "reasons", "receiptHash", "revoked", "riskScore", "zkpAttestation" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_apiKey_key" ON "Organization"("apiKey");
