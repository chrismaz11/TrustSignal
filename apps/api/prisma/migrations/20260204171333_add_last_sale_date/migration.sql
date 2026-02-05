-- CreateTable
CREATE TABLE "Receipt" (
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
    "revoked" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "Property" (
    "parcelId" TEXT NOT NULL PRIMARY KEY,
    "currentOwner" TEXT NOT NULL,
    "lastSaleDate" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CountyRecord" (
    "parcelId" TEXT NOT NULL PRIMARY KEY,
    "county" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);
