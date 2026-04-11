-- Add performance indexes to Receipt table for high-traffic query patterns

CREATE INDEX IF NOT EXISTS "Receipt_createdAt_idx"
    ON "Receipt"("createdAt");

CREATE INDEX IF NOT EXISTS "Receipt_revoked_createdAt_idx"
    ON "Receipt"("revoked", "createdAt");

CREATE INDEX IF NOT EXISTS "Receipt_policyProfile_createdAt_idx"
    ON "Receipt"("policyProfile", "createdAt");
