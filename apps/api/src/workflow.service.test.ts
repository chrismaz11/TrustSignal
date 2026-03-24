import { describe, expect, it } from 'vitest';

import { WorkflowService } from './workflow/service.js';

describe('WorkflowService', () => {
  it('produces deterministic artifact hashes for identical content', () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');

    const firstArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'internal',
      parentIds: [],
      content: {
        schemaVersion: 'trustsignal.workflow.input.v1',
        name: 'coverage-summary',
        metrics: { lines: 99.34, functions: 93.33, statements: 100 }
      }
    });

    const secondArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'internal',
      parentIds: [],
      content: {
        schemaVersion: 'trustsignal.workflow.input.v1',
        name: 'coverage-summary',
        metrics: { lines: 99.34, functions: 93.33, statements: 100 }
      }
    });

    expect(firstArtifact.hash).toBe(secondArtifact.hash);
  });

  it('maintains parent child lineage in derived artifacts', async () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const sourceArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'internal',
      parentIds: [],
      content: {
        schemaVersion: 'trustsignal.workflow.input.v1',
        source: 'lint-report'
      }
    });

    await service.runWorkflow(workflow.id, {
      createdBy: 'operator@trustsignal.test',
      steps: [
        {
          agentId: 'trustagents.lineage.capture',
          inputArtifactIds: [sourceArtifact.id]
        }
      ]
    });

    const state = service.getWorkflowState(workflow.id);
    expect(state).not.toBeNull();
    const derivedArtifacts = state!.artifacts.filter((artifact) => artifact.id !== sourceArtifact.id);
    expect(derivedArtifacts).toHaveLength(1);
    expect(derivedArtifacts[0]?.parentIds).toEqual([sourceArtifact.id]);
  });

  it('inherits the strongest parent classification by default', async () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const restrictedArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'audit_private',
      parentIds: [],
      content: {
        schemaVersion: 'trustsignal.workflow.input.v1',
        source: 'db-runtime-proof'
      }
    });

    await service.runWorkflow(workflow.id, {
      createdBy: 'operator@trustsignal.test',
      steps: [
        {
          agentId: 'trustagents.lineage.capture',
          inputArtifactIds: [restrictedArtifact.id]
        }
      ]
    });

    const state = service.getWorkflowState(workflow.id);
    const derivedArtifact = state!.artifacts.find((artifact) => artifact.id !== restrictedArtifact.id);
    expect(derivedArtifact?.classification).toBe('audit_private');
  });

  it('blocks release of audit private artifacts to customer shareable targets', () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const artifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'audit_private',
      parentIds: [],
      content: {
        schemaVersion: 'trustsignal.workflow.input.v1',
        source: 'private-audit-summary'
      }
    });

    const decision = service.evaluateReleaseDecision(
      workflow.id,
      artifact.id,
      'customer_shareable'
    );

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('customer_shareable_requires_public_classification');
    expect(decision.workflowId).toBe(workflow.id);
    expect(decision.artifactId).toBe(artifact.id);
    expect(decision.classification).toBe('audit_private');
    expect(typeof decision.timestamp).toBe('string');
  });

  it('fails closed on classification downgrade across conflicting parents', () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const publicArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'public',
      parentIds: [],
      content: { schemaVersion: 'trustsignal.workflow.input.v1', source: 'public-summary' }
    });
    const privateArtifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'audit_private',
      parentIds: [],
      content: { schemaVersion: 'trustsignal.workflow.input.v1', source: 'private-gap' }
    });

    expect(() =>
      service.createArtifact({
        workflowId: workflow.id,
        createdBy: 'operator@trustsignal.test',
        classification: 'public',
        parentIds: [publicArtifact.id, privateArtifact.id],
        content: { schemaVersion: 'trustsignal.workflow.bundle.v1', source: 'downgraded-export' }
      })
    ).toThrow('artifact_classification_downgrade_forbidden');
  });

  it('records repeated verification attempts explicitly', () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const artifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'internal',
      parentIds: [],
      content: { schemaVersion: 'trustsignal.workflow.input.v1', source: 'repeat-check' }
    });

    const first = service.verifyArtifact(workflow.id, artifact.id);
    const second = service.verifyArtifact(workflow.id, artifact.id);
    const state = service.getWorkflowState(workflow.id);

    expect(first.verified).toBe(true);
    expect(second.verified).toBe(true);
    expect(state?.verifications).toHaveLength(2);
  });

  it('rejects invalid release targets fail closed', () => {
    const service = new WorkflowService();
    const workflow = service.createWorkflow('operator@trustsignal.test');
    const artifact = service.createArtifact({
      workflowId: workflow.id,
      createdBy: 'operator@trustsignal.test',
      classification: 'internal',
      parentIds: [],
      content: { schemaVersion: 'trustsignal.workflow.input.v1', source: 'invalid-target' }
    });

    expect(() =>
      service.evaluateReleaseDecision(workflow.id, artifact.id, 'partner_portal' as never)
    ).toThrow('invalid_release_target');
  });

  it('builds an internal evidence package when all workflow artifacts remain internal', async () => {
    const service = new WorkflowService();
    const result = await service.runEnterpriseReadinessAuditWorkflow({
      createdBy: 'readiness@trustsignal.test',
      sourceArtifacts: [
        {
          sourceRef: 'coverage',
          name: 'coverage-summary',
          classification: 'internal',
          content: { lines: 99.34 }
        }
      ],
      findings: [
        {
          id: 'lint-failure',
          title: 'Lint gate is failing',
          severity: 'high',
          status: 'open',
          details: 'npm run lint remains red.',
          evidenceSourceRefs: ['coverage']
        }
      ],
      summary: {
        conclusion: 'no_go',
        highlights: ['Only internal evidence was provided.']
      },
      unsupportedClaims: ['Enterprise-ready'],
      unverifiedControls: ['staging TLS'],
      releaseTargets: {
        findings: 'internal_draft',
        summary: 'internal_draft'
      }
    });

    expect(result.evidencePackage.classification).toBe('internal');
    expect(result.evidencePackage.unsupportedClaims).toEqual(['Enterprise-ready']);
    expect(result.evidencePackage.unverifiedControls).toEqual(['staging TLS']);
    expect(service.getEvidencePackage(result.workflow.id)?.id).toBe(result.evidencePackage.id);
  });
});
