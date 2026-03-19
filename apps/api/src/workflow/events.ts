export type WorkflowEvent =
  | { type: 'workflow.created'; workflowId: string; actor: string; timestamp: string }
  | { type: 'workflow.run.started'; workflowId: string; runId: string; timestamp: string }
  | { type: 'workflow.run.completed'; workflowId: string; runId: string; timestamp: string }
  | { type: 'workflow.run.failed'; workflowId: string; runId: string; timestamp: string; reason: string }
  | { type: 'workflow.artifact.created'; workflowId: string; artifactId: string; classification: string; timestamp: string }
  | { type: 'workflow.artifact.verified'; workflowId: string; artifactId: string; timestamp: string; verified: boolean }
  | { type: 'workflow.release.evaluated'; workflowId: string; artifactId: string; target: string; timestamp: string; allowed: boolean }
  | { type: 'workflow.evidence_package.created'; workflowId: string; packageId: string; classification: string; timestamp: string };

export interface WorkflowEventSink {
  record(event: WorkflowEvent): void;
}

export class NoopWorkflowEventSink implements WorkflowEventSink {
  record(_event: WorkflowEvent): void {
    // Intentionally empty. This is the local-only default seam for future audit/event logging.
  }
}
