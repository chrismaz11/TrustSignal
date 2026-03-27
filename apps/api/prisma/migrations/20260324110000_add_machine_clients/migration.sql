CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "userEmail" TEXT,
    "clientType" TEXT NOT NULL DEFAULT 'machine',
    "scopes" TEXT NOT NULL DEFAULT 'verify read',
    "jwks" JSONB,
    "jwksUrl" TEXT,
    "subscriptionId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "usageLimit" INTEGER NOT NULL DEFAULT 100,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL DEFAULT 'self-service',
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClientAssertionNonce" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "jtiHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientAssertionNonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientAssertionNonce_clientId_jtiHash_key" ON "ClientAssertionNonce"("clientId", "jtiHash");
CREATE INDEX "ClientAssertionNonce_expiresAt_idx" ON "ClientAssertionNonce"("expiresAt");

ALTER TABLE "ClientAssertionNonce" ADD CONSTRAINT "ClientAssertionNonce_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
