import { describe, it, expect } from 'vitest';
import { WorkflowError, isWorkflowError, WorkflowErrorCode } from '../../../workflow/errors.js';

describe('WorkflowError', () => {
  it('should create error with code and message', () => {
    const error = new WorkflowError('workflow_not_found', 'Workflow not found');
    expect(error.code).toBe('workflow_not_found');
    expect(error.message).toBe('Workflow not found');
    expect(error.name).toBe('WorkflowError');
  });

  it('should create error with code only', () => {
    const error = new WorkflowError('artifact_not_found');
    expect(error.code).toBe('artifact_not_found');
    expect(error.message).toBe('artifact_not_found');
  });

  it('should create error with metadata', () => {
    const error = new WorkflowError('workflow_run_failed', 'Workflow failed', { detail: 'timeout' });
    expect(error.metadata).toEqual({ detail: 'timeout' });
  });

  it('should be identifiable with isWorkflowError', () => {
    const error = new WorkflowError('agent_not_found');
    expect(isWorkflowError(error)).toBe(true);
  });

  it('should not identify non-WorkflowError as WorkflowError', () => {
    const error = new Error('regular error');
    expect(isWorkflowError(error)).toBe(false);
  });

  it('should handle all error codes', () => {
    const codes: WorkflowErrorCode[] = [
      'workflow_not_found',
      'artifact_not_found',
      'agent_not_found',
      'artifact_classification_downgrade_forbidden',
      'workflow_run_failed',
      'unknown_source_ref',
      'invalid_release_target'
    ];

    codes.forEach(code => {
      const error = new WorkflowError(code);
      expect(error.code).toBe(code);
    });
  });
});
