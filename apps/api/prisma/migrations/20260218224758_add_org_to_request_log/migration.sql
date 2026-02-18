-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RequestLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "userAgent" TEXT,
    "receiptId" TEXT,
    "status" INTEGER NOT NULL,
    "organizationId" TEXT,
    CONSTRAINT "RequestLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RequestLog" ("endpoint", "id", "ip", "method", "receiptId", "status", "timestamp", "userAgent") SELECT "endpoint", "id", "ip", "method", "receiptId", "status", "timestamp", "userAgent" FROM "RequestLog";
DROP TABLE "RequestLog";
ALTER TABLE "new_RequestLog" RENAME TO "RequestLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
