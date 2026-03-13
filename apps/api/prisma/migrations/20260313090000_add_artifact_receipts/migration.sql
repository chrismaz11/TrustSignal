CREATE TABLE "ArtifactReceipt" (
    "receiptId" TEXT NOT NULL PRIMARY KEY,
    "verificationId" TEXT NOT NULL,
    "artifactHash" TEXT NOT NULL,
    "algorithm" TEXT NOT NULL,
    "sourceProvider" TEXT NOT NULL,
    "repository" TEXT,
    "workflow" TEXT,
    "runId" TEXT,
    "commitSha" TEXT,
    "actor" TEXT,
    "status" TEXT NOT NULL,
    "receiptSignature" TEXT NOT NULL,
    "receiptSignatureAlg" TEXT NOT NULL,
    "receiptSignatureKid" TEXT NOT NULL,
    "metadataArtifactPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "ArtifactReceipt_verificationId_key"
ON "ArtifactReceipt" ("verificationId");

CREATE INDEX "ArtifactReceipt_createdAt_idx"
ON "ArtifactReceipt" ("createdAt");

ALTER TABLE "ArtifactReceipt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ArtifactReceipt" FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    CREATE POLICY "artifact_receipts_postgres_all"
    ON "ArtifactReceipt"
    FOR ALL
    TO postgres
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "artifact_receipts_service_role_all"
    ON "ArtifactReceipt"
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
  END IF;
END $$;
