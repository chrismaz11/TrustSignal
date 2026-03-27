CREATE TABLE "UserAccount" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "passwordHash" TEXT NOT NULL,
    "passwordSalt" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Client"
ADD COLUMN "ownerUserId" TEXT;

ALTER TABLE "Client"
ADD CONSTRAINT "Client_ownerUserId_fkey"
FOREIGN KEY ("ownerUserId") REFERENCES "UserAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientRedirectUri" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRedirectUri_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BrowserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "BrowserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthConsentGrant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedScopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthConsentGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthAuthorizationRequest" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT,
    "redirectUri" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "state" TEXT,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorizationRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "codeChallengeMethod" TEXT NOT NULL DEFAULT 'S256',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAccount_email_key" ON "UserAccount"("email");
CREATE INDEX "Client_ownerUserId_idx" ON "Client"("ownerUserId");
CREATE UNIQUE INDEX "ClientRedirectUri_clientId_redirectUri_key" ON "ClientRedirectUri"("clientId", "redirectUri");
CREATE INDEX "ClientRedirectUri_clientId_idx" ON "ClientRedirectUri"("clientId");
CREATE UNIQUE INDEX "BrowserSession_sessionTokenHash_key" ON "BrowserSession"("sessionTokenHash");
CREATE INDEX "BrowserSession_expiresAt_idx" ON "BrowserSession"("expiresAt");
CREATE INDEX "BrowserSession_userId_expiresAt_idx" ON "BrowserSession"("userId", "expiresAt");
CREATE UNIQUE INDEX "OAuthConsentGrant_clientId_userId_key" ON "OAuthConsentGrant"("clientId", "userId");
CREATE INDEX "OAuthConsentGrant_clientId_idx" ON "OAuthConsentGrant"("clientId");
CREATE INDEX "OAuthConsentGrant_userId_idx" ON "OAuthConsentGrant"("userId");
CREATE INDEX "OAuthAuthorizationRequest_clientId_expiresAt_idx" ON "OAuthAuthorizationRequest"("clientId", "expiresAt");
CREATE INDEX "OAuthAuthorizationRequest_userId_expiresAt_idx" ON "OAuthAuthorizationRequest"("userId", "expiresAt");
CREATE UNIQUE INDEX "OAuthAuthorizationCode_codeHash_key" ON "OAuthAuthorizationCode"("codeHash");
CREATE INDEX "OAuthAuthorizationCode_clientId_expiresAt_idx" ON "OAuthAuthorizationCode"("clientId", "expiresAt");
CREATE INDEX "OAuthAuthorizationCode_userId_expiresAt_idx" ON "OAuthAuthorizationCode"("userId", "expiresAt");

ALTER TABLE "ClientRedirectUri" ADD CONSTRAINT "ClientRedirectUri_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BrowserSession" ADD CONSTRAINT "BrowserSession_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthConsentGrant" ADD CONSTRAINT "OAuthConsentGrant_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthConsentGrant" ADD CONSTRAINT "OAuthConsentGrant_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationRequest" ADD CONSTRAINT "OAuthAuthorizationRequest_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "UserAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
