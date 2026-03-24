CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userEmail" TEXT,
    "subscriptionId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "usageLimit" INTEGER NOT NULL DEFAULT 100,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "label" TEXT,
    "scopes" TEXT NOT NULL DEFAULT 'verify',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'system',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VerificationRecord" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "repository" TEXT NOT NULL,
    "commitSha" TEXT NOT NULL,
    "workflowRunId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyPrefix_key" ON "ApiKey"("keyPrefix");
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "VerificationRecord_apiKeyId_createdAt_idx" ON "VerificationRecord"("apiKeyId", "createdAt");

ALTER TABLE "VerificationRecord"
ADD CONSTRAINT "VerificationRecord_apiKeyId_fkey"
FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
