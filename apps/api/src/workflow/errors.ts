export type WorkflowErrorCode =
  | 'workflow_not_found'
  | 'artifact_not_found'
  | 'agent_not_found'
  | 'artifact_classification_downgrade_forbidden'
  | 'workflow_run_failed'
  | 'unknown_source_ref'
  | 'invalid_release_target';

export class WorkflowError extends Error {
  readonly code: WorkflowErrorCode;
  readonly metadata?: Record<string, string>;

  constructor(code: WorkflowErrorCode, message?: string, metadata?: Record<string, string>) {
    super(message ?? code);
    this.name = 'WorkflowError';
    this.code = code;
    this.metadata = metadata;
  }
}

export function isWorkflowError(error: unknown): error is WorkflowError {
  return error instanceof WorkflowError;
}
