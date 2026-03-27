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
      "signingKeyId" TEXT,
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
    `ALTER TABLE "Receipt" ADD COLUMN IF NOT EXISTS "signingKeyId" TEXT`,
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
      "accessType" TEXT NOT NULL DEFAULT 'API',
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
      "jobType" TEXT NOT NULL DEFAULT 'VERIFY',
      "status" TEXT NOT NULL,
      "resultStatus" TEXT,
      "proofUri" TEXT,
      "error" TEXT,
      "snapshotCapturedAt" TIMESTAMP(3),
      "snapshotSourceVersion" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "completedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "WorkflowEvent" (
      "id" TEXT PRIMARY KEY,
      "workflowId" TEXT NOT NULL,
      "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "operator" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "bundleId" TEXT,
      "decision" TEXT,
      "receiptId" TEXT,
      "eventType" TEXT NOT NULL,
      "runId" TEXT,
      "artifactId" TEXT,
      "packageId" TEXT,
      "classification" TEXT,
      "reason" TEXT,
      "payload" JSONB NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Client" (
      "id" TEXT PRIMARY KEY,
      "name" TEXT,
      "userEmail" TEXT,
      "clientType" TEXT NOT NULL DEFAULT 'machine',
      "scopes" TEXT NOT NULL DEFAULT 'verify read',
      "jwks" JSONB,
      "jwksUrl" TEXT,
      "ownerUserId" TEXT REFERENCES "UserAccount"("id") ON DELETE SET NULL,
      "subscriptionId" TEXT,
      "plan" TEXT NOT NULL DEFAULT 'FREE',
      "usageLimit" INTEGER NOT NULL DEFAULT 100,
      "usageCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT NOT NULL DEFAULT 'self-service',
      "revokedAt" TIMESTAMP(3),
      "lastUsedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "ClientAssertionNonce" (
      "id" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "jtiHash" TEXT NOT NULL,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ClientRedirectUri" (
      "id" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "redirectUri" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "UserAccount" (
      "id" TEXT PRIMARY KEY,
      "email" TEXT NOT NULL,
      "displayName" TEXT,
      "passwordHash" TEXT NOT NULL DEFAULT '',
      "passwordSalt" TEXT NOT NULL DEFAULT '',
      "disabledAt" TIMESTAMP(3),
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastLoginAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "BrowserSession" (
      "id" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE CASCADE,
      "sessionTokenHash" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "revokedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "OAuthConsentGrant" (
      "id" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE CASCADE,
      "grantedScopes" TEXT NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "revokedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "OAuthAuthorizationRequest" (
      "id" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "userId" TEXT REFERENCES "UserAccount"("id") ON DELETE CASCADE,
      "redirectUri" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "state" TEXT,
      "codeChallenge" TEXT NOT NULL,
      "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "consumedAt" TIMESTAMP(3)
    )`,
    `CREATE TABLE IF NOT EXISTS "OAuthAuthorizationCode" (
      "id" TEXT PRIMARY KEY,
      "clientId" TEXT NOT NULL REFERENCES "Client"("id") ON DELETE CASCADE,
      "userId" TEXT NOT NULL REFERENCES "UserAccount"("id") ON DELETE CASCADE,
      "codeHash" TEXT NOT NULL,
      "redirectUri" TEXT NOT NULL,
      "scope" TEXT NOT NULL,
      "codeChallenge" TEXT NOT NULL,
      "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "expiresAt" TIMESTAMP(3) NOT NULL,
      "usedAt" TIMESTAMP(3)
    )`,
    `ALTER TABLE "RegistrySource" ADD COLUMN IF NOT EXISTS "accessType" TEXT NOT NULL DEFAULT 'API'`,
    `ALTER TABLE "RegistryOracleJob" ADD COLUMN IF NOT EXISTS "jobType" TEXT NOT NULL DEFAULT 'VERIFY'`,
    `ALTER TABLE "RegistryOracleJob" ADD COLUMN IF NOT EXISTS "snapshotCapturedAt" TIMESTAMP(3)`,
    `ALTER TABLE "RegistryOracleJob" ADD COLUMN IF NOT EXISTS "snapshotSourceVersion" TEXT`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "clientType" TEXT NOT NULL DEFAULT 'machine'`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "scopes" TEXT NOT NULL DEFAULT 'verify read'`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "jwks" JSONB`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "jwksUrl" TEXT`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'FREE'`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "usageLimit" INTEGER NOT NULL DEFAULT 100`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "usageCount" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "createdBy" TEXT NOT NULL DEFAULT 'self-service'`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3)`,
    `ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3)`,
    `ALTER TABLE "ClientAssertionNonce" ADD COLUMN IF NOT EXISTS "jtiHash" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "ClientAssertionNonce" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "ClientAssertionNonce" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP`,
    `ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "passwordSalt" TEXT NOT NULL DEFAULT ''`,
    `ALTER TABLE "UserAccount" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3)`,
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
    `CREATE INDEX IF NOT EXISTS "WorkflowEvent_workflowId_timestamp_idx"
      ON "WorkflowEvent" ("workflowId", "timestamp")`,
    `CREATE INDEX IF NOT EXISTS "RegistrySource_active_idx"
      ON "RegistrySource" ("active")`,
    `CREATE INDEX IF NOT EXISTS "Client_revokedAt_idx"
      ON "Client" ("revokedAt")`,
    `CREATE INDEX IF NOT EXISTS "Client_ownerUserId_idx"
      ON "Client" ("ownerUserId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ClientAssertionNonce_clientId_jtiHash_key"
      ON "ClientAssertionNonce" ("clientId", "jtiHash")`,
    `CREATE INDEX IF NOT EXISTS "ClientAssertionNonce_expiresAt_idx"
      ON "ClientAssertionNonce" ("expiresAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "ClientRedirectUri_clientId_redirectUri_key"
      ON "ClientRedirectUri" ("clientId", "redirectUri")`,
    `CREATE INDEX IF NOT EXISTS "ClientRedirectUri_clientId_idx"
      ON "ClientRedirectUri" ("clientId")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "UserAccount_email_key"
      ON "UserAccount" ("email")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "BrowserSession_sessionTokenHash_key"
      ON "BrowserSession" ("sessionTokenHash")`,
    `CREATE INDEX IF NOT EXISTS "BrowserSession_expiresAt_idx"
      ON "BrowserSession" ("expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "BrowserSession_userId_expiresAt_idx"
      ON "BrowserSession" ("userId", "expiresAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "OAuthConsentGrant_clientId_userId_key"
      ON "OAuthConsentGrant" ("clientId", "userId")`,
    `CREATE INDEX IF NOT EXISTS "OAuthConsentGrant_clientId_idx"
      ON "OAuthConsentGrant" ("clientId")`,
    `CREATE INDEX IF NOT EXISTS "OAuthConsentGrant_userId_idx"
      ON "OAuthConsentGrant" ("userId")`,
    `CREATE INDEX IF NOT EXISTS "OAuthAuthorizationRequest_clientId_expiresAt_idx"
      ON "OAuthAuthorizationRequest" ("clientId", "expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "OAuthAuthorizationRequest_userId_expiresAt_idx"
      ON "OAuthAuthorizationRequest" ("userId", "expiresAt")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "OAuthAuthorizationCode_codeHash_key"
      ON "OAuthAuthorizationCode" ("codeHash")`,
    `CREATE INDEX IF NOT EXISTS "OAuthAuthorizationCode_clientId_expiresAt_idx"
      ON "OAuthAuthorizationCode" ("clientId", "expiresAt")`,
    `CREATE INDEX IF NOT EXISTS "OAuthAuthorizationCode_userId_expiresAt_idx"
      ON "OAuthAuthorizationCode" ("userId", "expiresAt")`
  ];

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
}
