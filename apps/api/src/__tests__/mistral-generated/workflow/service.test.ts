import { describe, it, expect, vi } from 'vitest';
import { WorkflowService } from '../../../workflow/service.js';
import { WorkflowError } from '../../../workflow/errors.js';
import { InMemoryWorkflowStore } from '../../../workflow/store.js';
import { NoopWorkflowEventSink } from '../../../workflow/events.js';

describe('WorkflowService', () => {
  describe('listAgents', () => {
    it('should list built-in agents', () => {
      const service = new WorkflowService();
      const agents = service.listAgents();
      expect(agents.length).toBeGreaterThan(0);
      expect(agents[0]).toHaveProperty('id');
      expect(agents[0]).toHaveProperty('description');
    });
  });

  describe('createWorkflow', () => {
    it('should create workflow with valid createdBy', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      expect(workflow.id).toBeDefined();
      expect(workflow.createdBy).toBe('user1');
      expect(workflow.status).toBe('pending');
    });

    it('should create workflow with different user', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user2');
      expect(workflow.createdBy).toBe('user2');
    });
  });

  describe('getWorkflowState', () => {
    it('should return null for non-existent workflow', () => {
      const service = new WorkflowService();
      const state = service.getWorkflowState('non-existent');
      expect(state).toBeNull();
    });

    it('should return workflow state for existing workflow', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const state = service.getWorkflowState(workflow.id);
      expect(state).toBeDefined();
      expect(state?.workflow.id).toBe(workflow.id);
    });
  });

  describe('createArtifact', () => {
    it('should create artifact for existing workflow', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });
      expect(artifact.id).toBeDefined();
      expect(artifact.workflowId).toBe(workflow.id);
    });

    it('should throw for non-existent workflow', () => {
      const service = new WorkflowService();
      expect(() => service.createArtifact({
        createdBy: 'user1',
        workflowId: 'non-existent',
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      })).toThrow(WorkflowError);
    });

    it('should inherit classification from parents', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const parent = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'internal',
        parentIds: [],
        content: { key: 'value' }
      });

      const child = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: undefined,
        parentIds: [parent.id],
        content: { key: 'value' }
      });

      expect(child.classification).toBe('internal');
    });
  });

  describe('verifyArtifact', () => {
    it('should verify artifact hash', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });

      const verification = service.verifyArtifact(workflow.id, artifact.id);
      expect(verification.verified).toBe(true);
      expect(verification.artifactId).toBe(artifact.id);
    });

    it('should detect tampered artifact', () => {
      const store = new InMemoryWorkflowStore();
      const service = new WorkflowService(undefined, { store });
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });

      // Tamper with the content
      const storedArtifact = store.getArtifact(artifact.id);
      if (storedArtifact) {
        storedArtifact.content = { key: 'tampered' };
      }

      const verification = service.verifyArtifact(workflow.id, artifact.id);
      expect(verification.verified).toBe(false);
    });
  });

  describe('evaluateReleaseDecision', () => {
    it('should allow public artifact for customer_shareable', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });

      const decision = service.evaluateReleaseDecision(workflow.id, artifact.id, 'customer_shareable');
      expect(decision.allowed).toBe(true);
    });

    it('should block internal artifact for customer_shareable', () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'internal',
        parentIds: [],
        content: { key: 'value' }
      });

      const decision = service.evaluateReleaseDecision(workflow.id, artifact.id, 'customer_shareable');
      expect(decision.allowed).toBe(false);
    });
  });

  describe('runWorkflow', () => {
    it('should run workflow with valid steps', async () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });

      const run = await service.runWorkflow(workflow.id, {
        createdBy: 'user1',
        steps: [
          {
            agentId: 'trustagents.lineage.capture',
            inputArtifactIds: [artifact.id]
          }
        ]
      });

      expect(run.steps.length).toBe(1);
      expect(run.steps[0].status).toBe('completed');
    });

    it('should throw for non-existent workflow', async () => {
      const service = new WorkflowService();
      await expect(service.runWorkflow('non-existent', {
        createdBy: 'user1',
        steps: [
          {
            agentId: 'trustagents.lineage.capture',
            inputArtifactIds: []
          }
        ]
      })).rejects.toThrow(WorkflowError);
    });

    it('should throw for non-existent agent', async () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');

      await expect(service.runWorkflow(workflow.id, {
        createdBy: 'user1',
        steps: [
          {
            agentId: 'non-existent-agent',
            inputArtifactIds: []
          }
        ]
      })).rejects.toThrow(WorkflowError);
    });

    it('should handle workflow failure gracefully', async () => {
      const service = new WorkflowService();
      const workflow = service.createWorkflow('user1');

      try {
        await service.runWorkflow(workflow.id, {
          createdBy: 'user1',
          steps: [
            {
              agentId: 'trustagents.lineage.capture',
              inputArtifactIds: ['non-existent-artifact']
            }
          ]
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WorkflowError);
      }

      const state = service.getWorkflowState(workflow.id);
      expect(state?.workflow.status).toBe('failed');
    });
  });

  describe('runEnterpriseReadinessAuditWorkflow', () => {
    it('should run readiness workflow', async () => {
      const service = new WorkflowService();
      const result = await service.runEnterpriseReadinessAuditWorkflow({
        createdBy: 'user1',
        sourceArtifacts: [
          {
            sourceRef: 'ref1',
            name: 'source1',
            classification: 'public',
            content: { key: 'value' }
          }
        ],
        findings: [
          {
            id: 'finding1',
            title: 'Finding 1',
            severity: 'low',
            status: 'open',
            details: 'Details',
            evidenceSourceRefs: ['ref1']
          }
        ],
        summary: {
          conclusion: 'go',
          highlights: ['All good']
        }
      });

      expect(result.workflow.id).toBeDefined();
      expect(result.sourceArtifacts.length).toBe(1);
      expect(result.findingArtifact.id).toBeDefined();
      expect(result.summaryArtifact.id).toBeDefined();
      expect(result.evidencePackage.id).toBeDefined();
      expect(result.result.conclusion).toBe('go');
    });

    it('should throw for unknown source ref', async () => {
      const service = new WorkflowService();

      await expect(service.runEnterpriseReadinessAuditWorkflow({
        createdBy: 'user1',
        sourceArtifacts: [
          {
            sourceRef: 'ref1',
            name: 'source1',
            classification: 'public',
            content: { key: 'value' }
          }
        ],
        findings: [
          {
            id: 'finding1',
            title: 'Finding 1',
            severity: 'low',
            status: 'open',
            details: 'Details',
            evidenceSourceRefs: ['unknown-ref']
          }
        ],
        summary: {
          conclusion: 'go',
          highlights: ['All good']
        }
      })).rejects.toThrow(WorkflowError);
    });

    it('should handle release decisions', async () => {
      const service = new WorkflowService();
      const result = await service.runEnterpriseReadinessAuditWorkflow({
        createdBy: 'user1',
        sourceArtifacts: [
          {
            sourceRef: 'ref1',
            name: 'source1',
            classification: 'public',
            content: { key: 'value' }
          }
        ],
        findings: [
          {
            id: 'finding1',
            title: 'Finding 1',
            severity: 'low',
            status: 'open',
            details: 'Details',
            evidenceSourceRefs: ['ref1']
          }
        ],
        summary: {
          conclusion: 'go',
          highlights: ['All good']
        },
        releaseTargets: {
          findings: 'internal_draft',
          summary: 'customer_shareable'
        }
      });

      expect(result.releaseDecisions.length).toBe(2);
      expect(result.result.releaseGate).toBe('pass');
    });
  });

  describe('event recording', () => {
    it('should record workflow events', () => {
      const store = new InMemoryWorkflowStore();
      const sink = new NoopWorkflowEventSink();
      const recordSpy = vi.spyOn(sink, 'record');

      const service = new WorkflowService(undefined, { store, eventSink: sink });
      const workflow = service.createWorkflow('user1');

      expect(recordSpy).toHaveBeenCalledWith({
        type: 'workflow.created',
        workflowId: workflow.id,
        actor: 'user1',
        timestamp: workflow.createdAt
      });
    });

    it('should record artifact events', () => {
      const store = new InMemoryWorkflowStore();
      const sink = new NoopWorkflowEventSink();
      const recordSpy = vi.spyOn(sink, 'record');

      const service = new WorkflowService(undefined, { store, eventSink: sink });
      const workflow = service.createWorkflow('user1');
      const artifact = service.createArtifact({
        createdBy: 'user1',
        workflowId: workflow.id,
        classification: 'public',
        parentIds: [],
        content: { key: 'value' }
      });

      expect(recordSpy).toHaveBeenCalledWith({
        type: 'workflow.artifact.created',
        workflowId: workflow.id,
        artifactId: artifact.id,
        actor: 'user1',
        classification: 'public',
        timestamp: artifact.createdAt
      });
    });
  });
});
