-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "rateLimit" INTEGER;
ALTER TABLE "Organization" ADD COLUMN "retentionDays" INTEGER;

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
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" DATETIME,
    "organizationId" TEXT,
    CONSTRAINT "Receipt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Receipt" ("anchorChainId", "anchorId", "anchorStatus", "anchorTxHash", "checks", "createdAt", "decision", "fraudRisk", "id", "inputsCommitment", "organizationId", "parcelId", "policyProfile", "rawInputs", "reasons", "receiptHash", "revoked", "riskScore", "zkpAttestation") SELECT "anchorChainId", "anchorId", "anchorStatus", "anchorTxHash", "checks", "createdAt", "decision", "fraudRisk", "id", "inputsCommitment", "organizationId", "parcelId", "policyProfile", "rawInputs", "reasons", "receiptHash", "revoked", "riskScore", "zkpAttestation" FROM "Receipt";
DROP TABLE "Receipt";
ALTER TABLE "new_Receipt" RENAME TO "Receipt";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
