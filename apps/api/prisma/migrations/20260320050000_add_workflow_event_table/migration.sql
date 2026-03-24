CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WorkflowEvent_workflowId_timestamp_idx"
ON "WorkflowEvent"("workflowId", "timestamp");
