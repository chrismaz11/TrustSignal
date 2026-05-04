import { describe, it, expect } from 'vitest';
import { InMemoryWorkflowStore } from '../../../workflow/store.js';
import type { Workflow, AgentRun, StoredArtifact, VerificationRecord, ReleaseDecision, EvidencePackage } from '../../../workflow/types.js';

describe('InMemoryWorkflowStore', () => {
  let store: InMemoryWorkflowStore;

  beforeEach(() => {
    store = new InMemoryWorkflowStore();
  });

  describe('workflow operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    it('should set and get workflow', () => {
      store.setWorkflow(mockWorkflow);
      const result = store.getWorkflow('workflow1');
      expect(result).toEqual(mockWorkflow);
    });

    it('should return undefined for non-existent workflow', () => {
      const result = store.getWorkflow('non-existent');
      expect(result).toBeUndefined();
    });

    it('should initialize empty arrays when setting workflow', () => {
      store.setWorkflow(mockWorkflow);
      expect(store.getRuns('workflow1')).toEqual([]);
      expect(store.getArtifactIds('workflow1')).toEqual([]);
      expect(store.getVerifications('workflow1')).toEqual([]);
      expect(store.getReleaseDecisions('workflow1')).toEqual([]);
    });
  });

  describe('run operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    const mockRun: AgentRun = {
      id: 'run1',
      workflowId: 'workflow1',
      steps: []
    };

    it('should append and get runs', () => {
      store.setWorkflow(mockWorkflow);
      store.appendRun('workflow1', mockRun);
      const result = store.getRuns('workflow1');
      expect(result).toEqual([mockRun]);
    });

    it('should return empty array for workflow with no runs', () => {
      store.setWorkflow(mockWorkflow);
      const result = store.getRuns('workflow1');
      expect(result).toEqual([]);
    });
  });

  describe('artifact operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    const mockArtifact: StoredArtifact = {
      id: 'artifact1',
      hash: 'hash1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      parentIds: [],
      workflowId: 'workflow1',
      classification: 'public',
      content: { key: 'value' }
    };

    it('should append and get artifact', () => {
      store.setWorkflow(mockWorkflow);
      store.appendArtifact('workflow1', mockArtifact);
      const result = store.getArtifact('artifact1');
      expect(result).toEqual(mockArtifact);
    });

    it('should return undefined for non-existent artifact', () => {
      const result = store.getArtifact('non-existent');
      expect(result).toBeUndefined();
    });

    it('should track artifact IDs by workflow', () => {
      store.setWorkflow(mockWorkflow);
      store.appendArtifact('workflow1', mockArtifact);
      const ids = store.getArtifactIds('workflow1');
      expect(ids).toEqual(['artifact1']);
    });

    it('should return empty array for workflow with no artifacts', () => {
      store.setWorkflow(mockWorkflow);
      const ids = store.getArtifactIds('workflow1');
      expect(ids).toEqual([]);
    });
  });

  describe('verification operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    const mockVerification: VerificationRecord = {
      artifactId: 'artifact1',
      hash: 'hash1',
      verified: true,
      timestamp: '2024-01-01T00:00:00Z'
    };

    it('should append and get verifications', () => {
      store.setWorkflow(mockWorkflow);
      store.appendVerification('workflow1', mockVerification);
      const result = store.getVerifications('workflow1');
      expect(result).toEqual([mockVerification]);
    });

    it('should return empty array for workflow with no verifications', () => {
      store.setWorkflow(mockWorkflow);
      const result = store.getVerifications('workflow1');
      expect(result).toEqual([]);
    });
  });

  describe('release decision operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    const mockDecision: ReleaseDecision = {
      workflowId: 'workflow1',
      artifactId: 'artifact1',
      classification: 'public',
      target: 'customer_shareable',
      allowed: true,
      reason: 'public_artifact_customer_shareable',
      timestamp: '2024-01-01T00:00:00Z'
    };

    it('should append and get release decisions', () => {
      store.setWorkflow(mockWorkflow);
      store.appendReleaseDecision('workflow1', mockDecision);
      const result = store.getReleaseDecisions('workflow1');
      expect(result).toEqual([mockDecision]);
    });

    it('should return empty array for workflow with no decisions', () => {
      store.setWorkflow(mockWorkflow);
      const result = store.getReleaseDecisions('workflow1');
      expect(result).toEqual([]);
    });
  });

  describe('evidence package operations', () => {
    const mockWorkflow: Workflow = {
      id: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      status: 'pending'
    };

    const mockPackage: EvidencePackage = {
      id: 'package1',
      workflowId: 'workflow1',
      createdAt: '2024-01-01T00:00:00Z',
      summaryArtifactId: 'artifact1',
      findingsArtifactId: 'artifact2',
      artifactIds: ['artifact1', 'artifact2'],
      evidenceReferences: [],
      verificationRecords: [],
      releaseDecisions: [],
      unsupportedClaims: [],
      unverifiedControls: [],
      classification: 'internal'
    };

    it('should set and get evidence package', () => {
      store.setWorkflow(mockWorkflow);
      store.setEvidencePackage('workflow1', mockPackage);
      const result = store.getEvidencePackage('workflow1');
      expect(result).toEqual(mockPackage);
    });

    it('should return undefined for workflow with no evidence package', () => {
      store.setWorkflow(mockWorkflow);
      const result = store.getEvidencePackage('workflow1');
      expect(result).toBeUndefined();
    });

    it('should return undefined for non-existent workflow', () => {
      const result = store.getEvidencePackage('non-existent');
      expect(result).toBeUndefined();
    });
  });

  describe('multiple workflows', () => {
    it('should isolate data between workflows', () => {
      const workflow1: Workflow = {
        id: 'workflow1',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user1',
        status: 'pending'
      };

      const workflow2: Workflow = {
        id: 'workflow2',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user2',
        status: 'pending'
      };

      store.setWorkflow(workflow1);
      store.setWorkflow(workflow2);

      const artifact1: StoredArtifact = {
        id: 'artifact1',
        hash: 'hash1',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user1',
        parentIds: [],
        workflowId: 'workflow1',
        classification: 'public',
        content: { key: 'value1' }
      };

      const artifact2: StoredArtifact = {
        id: 'artifact2',
        hash: 'hash2',
        createdAt: '2024-01-01T00:00:00Z',
        createdBy: 'user2',
        parentIds: [],
        workflowId: 'workflow2',
        classification: 'public',
        content: { key: 'value2' }
      };

      store.appendArtifact('workflow1', artifact1);
      store.appendArtifact('workflow2', artifact2);

      expect(store.getArtifactIds('workflow1')).toEqual(['artifact1']);
      expect(store.getArtifactIds('workflow2')).toEqual(['artifact2']);
      expect(store.getArtifact('artifact1')?.workflowId).toBe('workflow1');
      expect(store.getArtifact('artifact2')?.workflowId).toBe('workflow2');
    });
  });
});
