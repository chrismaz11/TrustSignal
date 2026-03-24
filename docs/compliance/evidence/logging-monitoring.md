# TrustSignal Logging and Monitoring Evidence

## Control Objective

Document that TrustSignal monitors security-relevant activity and retains reviewable monitoring evidence through approved operational systems.

## Repository-Backed Evidence

The repository now supports workflow audit trail persistence for Trust Agents orchestration:

- workflow audit events are emitted through `apps/api/src/workflow/events.ts`
- runtime persistence is backed by the `WorkflowEvent` table in Prisma
- events are queryable by workflow ID through `GET /api/v1/workflows/:workflowId/events`

Expected event fields for audit review:

- `timestamp`
- `operator`
- `action`
- `workflowId`
- `bundleId` when an artifact or package identifier exists
- `decision` for release or verification outcomes
- `receiptId` when workflow automation is later linked to receipt issuance
- raw event payload for reconstruction and forensic review

## Auditor Evidence To Capture

For audit evidence collection, capture:

- one successful workflow run showing events persisted in the `WorkflowEvent` table
- one API response from `GET /api/v1/workflows/:workflowId/events`
- one screenshot or export from the monitoring system showing alert review or dashboard evidence
- operator review notes for at least one verification or release-decision workflow

## Where Evidence Is Stored

Store production logs, screenshots, dashboard exports, and workflow-event query evidence in:

- Vanta
- a private audit repository
- approved internal compliance storage

Do not store production logs, alert payloads, or internal monitoring screenshots in this public repository.
