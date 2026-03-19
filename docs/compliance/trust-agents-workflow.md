# Trust Agents And TrustSignal Workflow

> This document describes the minimum viable combined workflow currently implemented in this repository. It does not claim a deployed Trust Agents platform, external oracle integration, or production workflow evidence.

## Current Implementation

The repository now contains a small local workflow subsystem in `apps/api/src/workflow/`.

- Trust Agents role:
  - execute workflow steps through a static in-memory agent registry
  - orchestrate derived artifact creation for readiness workflows
  - fail closed if an unknown agent is requested
- TrustSignal role:
  - hash artifact content using existing canonicalization and keccak primitives
  - bind parent and child artifacts through lineage metadata
  - issue verification records by recomputing artifact hashes
  - evaluate release decisions against classification policy

## What Exists Now

Implemented now:

- shared workflow, artifact, verification, evidence-reference, and release-decision types
- in-memory workflow service
- built-in local agents:
  - `trustagents.lineage.capture`
  - `trustagents.integrity.verify`
  - `trustagents.artifact.bundle`
  - `trustagents.readiness.findings`
  - `trustagents.readiness.summary`
- API routes for:
  - listing available Trust Agents
  - creating workflows
  - registering artifacts
  - verifying artifacts
  - running generic workflow steps
  - running the enterprise readiness audit workflow
- policy gate that evaluates whether an artifact can be released as:
  - `internal_draft`
  - `customer_shareable`
  - `audit_private`

Not implemented now:

- persistent workflow storage
- distributed agent execution
- background job execution
- external Trust Agents runtime
- oracle-backed workflow steps
- deployment-specific audit logging
- staging or production evidence capture automation

## API Surface

The current local workflow API is exposed from `apps/api/src/server.ts`.

- `GET /api/v1/trust-agents`
  - returns the locally registered workflow agents
  - current registry mode is static and in-memory
- `POST /api/v1/workflows`
  - creates a workflow envelope
- `GET /api/v1/workflows/:workflowId`
  - returns current workflow state
- `POST /api/v1/workflows/:workflowId/artifacts`
  - registers a workflow artifact
- `POST /api/v1/workflows/:workflowId/runs`
  - runs explicit workflow steps against registered artifacts
- `POST /api/v1/workflows/:workflowId/artifacts/:artifactId/verify`
  - recomputes and records verification for one artifact
- `POST /api/v1/workflows/readiness-audit`
  - runs the first concrete enterprise-readiness audit workflow

These routes are API-exposed in this repository only. They are not evidence of a deployed orchestration system.

## Artifact Flow

The first implemented workflow is the enterprise readiness audit workflow.

1. Source artifacts are registered as workflow inputs.
2. `trustagents.readiness.findings` creates a derived findings artifact.
3. `trustagents.readiness.summary` creates a derived summary artifact.
4. TrustSignal verifies the derived artifacts by recomputing hashes.
5. TrustSignal evaluates release decisions for the findings and summary outputs.

## Classification Model

Artifact classifications are:

- `public`
- `internal`
- `audit_private`
- `restricted`

Rules implemented now:

- derived artifacts inherit the strongest parent classification when a classification is not explicitly requested
- classification downgrades are blocked
- `customer_shareable` release requires `public`
- `internal_draft` release allows only `public` or `internal`
- `audit_private` release blocks `restricted`
- invalid or downgraded release attempts fail closed
- repeated verification attempts are recorded explicitly rather than silently reused

This release gate is a code-level policy control. It is not a substitute for private artifact storage, access review, or operational evidence governance.

## Readiness Workflow Result

The readiness workflow returns a machine-readable object containing:

- workflow metadata
- source artifact metadata
- findings artifact metadata
- summary artifact metadata
- evidence package metadata
- evidence references
- verification records
- release decisions
- a final release gate result

## Evidence Package

The readiness workflow now emits a first-class in-memory evidence package.

The package contains:

- package id and workflow id
- summary artifact id
- findings artifact id
- all workflow artifact ids included in the package
- evidence references that bind source, finding, and summary lineage
- verification records
- release decisions
- unsupported claims
- unverified controls
- package classification

The package classification is intentionally narrow:

- `internal`
- `audit_private`

If any included workflow artifact is `audit_private` or `restricted`, the package is classified as `audit_private`.

This package is machine-readable and internally auditable, but it is still local-only and in-memory. It is not a durable audit system of record.

## Boundary Notes

This implementation establishes a real local pattern for combined orchestration and integrity enforcement, but it is still a minimum viable subsystem.

It should be described as:

- a local in-repo Trust Agents orchestration layer
- backed by TrustSignal artifact hashing, lineage, and policy gating
- with in-memory state only
- with API exposure only inside the current application process

It should not be described as:

- a deployed Trust Agents platform
- a production-ready enterprise workflow engine
- a staging-proven or production-proven control system
- an oracle-integrated or auditor-complete workflow

## Future Seams

The current code now includes explicit seams for future extension:

- persistence:
  - `WorkflowStore` with `InMemoryWorkflowStore` as the current implementation
- event or audit logging:
  - `WorkflowEventSink` with `NoopWorkflowEventSink` as the current implementation
- evidence packaging:
  - evidence packages are generated now
  - persistent storage or export pipelines for those packages are not yet implemented

These seams exist to support later persistence and workflow event capture without pretending those capabilities already exist.
