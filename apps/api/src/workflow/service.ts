import { randomUUID } from 'node:crypto';

import {
  canonicalizeJson,
  keccak256Utf8
} from '../../../../packages/core/dist/index.js';

import {
  evaluateReleaseDecisionForArtifact,
  nowIso,
  resolveOutputClassification
} from './policy.js';
import { NoopWorkflowEventSink, type WorkflowEventSink } from './events.js';
import { WorkflowError } from './errors.js';
import { InMemoryWorkflowStore, type WorkflowStore } from './store.js';
import type {
  AgentDescriptor,
  AgentRun,
  Artifact,
  ArtifactClassification,
  EvidencePackage,
  EvidenceReference,
  ReadinessWorkflowRequest,
  ReleaseDecision,
  ReleaseTarget,
  StoredArtifact,
  VerificationRecord,
  Workflow,
  WorkflowRunRequest,
  WorkflowRunStepRequest,
  WorkflowStep
} from './types.js';

type AgentExecutionContext = {
  workflow: Workflow;
  step: WorkflowStep;
  createdBy: string;
  inputArtifacts: StoredArtifact[];
  classification?: ArtifactClassification;
  parameters: Record<string, unknown>;
  createArtifact: (input: {
    createdBy: string;
    workflowId: string;
    classification: ArtifactClassification;
    parentIds: string[];
    content: unknown;
  }) => Artifact;
  verifyArtifact: (artifactId: string) => VerificationRecord;
};

type AgentDefinition = AgentDescriptor & {
  execute: (context: AgentExecutionContext) => Promise<{ outputArtifactIds: string[] }>;
};

type WorkflowState = {
  workflow: Workflow;
  runs: AgentRun[];
  artifacts: Artifact[];
  verifications: VerificationRecord[];
  releaseDecisions: ReleaseDecision[];
};

function createBuiltInAgents(): Map<string, AgentDefinition> {
  const agents: AgentDefinition[] = [
    {
      id: 'trustagents.lineage.capture',
      description: 'Captures a lineage snapshot over upstream TrustSignal artifacts.',
      async execute(context) {
        const classification = resolveOutputClassification(context.classification, context.inputArtifacts);
        const output = context.createArtifact({
          createdBy: context.createdBy,
          workflowId: context.workflow.id,
          classification,
          parentIds: context.inputArtifacts.map((artifact) => artifact.id),
          content: {
            schemaVersion: 'trustsignal.workflow.lineage_snapshot.v1',
            workflowId: context.workflow.id,
            stepId: context.step.id,
            sourceArtifacts: context.inputArtifacts.map((artifact) => ({
              artifactId: artifact.id,
              hash: artifact.hash,
              classification: artifact.classification
            })),
            parameters: context.parameters
          }
        });

        return { outputArtifactIds: [output.id] };
      }
    },
    {
      id: 'trustagents.integrity.verify',
      description: 'Verifies TrustSignal artifact hashes and emits a verifiable integrity summary.',
      async execute(context) {
        const results = context.inputArtifacts.map((artifact) => context.verifyArtifact(artifact.id));
        const classification = resolveOutputClassification(context.classification, context.inputArtifacts);
        const output = context.createArtifact({
          createdBy: context.createdBy,
          workflowId: context.workflow.id,
          classification,
          parentIds: context.inputArtifacts.map((artifact) => artifact.id),
          content: {
            schemaVersion: 'trustsignal.workflow.integrity_verification.v1',
            workflowId: context.workflow.id,
            stepId: context.step.id,
            verifications: results
          }
        });

        return { outputArtifactIds: [output.id] };
      }
    },
    {
      id: 'trustagents.artifact.bundle',
      description: 'Produces a workflow-local bundle artifact from upstream TrustSignal artifacts.',
      async execute(context) {
        const classification = resolveOutputClassification(context.classification, context.inputArtifacts);
        const output = context.createArtifact({
          createdBy: context.createdBy,
          workflowId: context.workflow.id,
          classification,
          parentIds: context.inputArtifacts.map((artifact) => artifact.id),
          content: {
            schemaVersion: 'trustsignal.workflow.bundle.v1',
            workflowId: context.workflow.id,
            stepId: context.step.id,
            inputs: context.inputArtifacts.map((artifact) => ({
              artifactId: artifact.id,
              hash: artifact.hash
            })),
            parameters: context.parameters
          }
        });

        return { outputArtifactIds: [output.id] };
      }
    },
    {
      id: 'trustagents.readiness.findings',
      description: 'Builds a readiness findings artifact from source evidence references.',
      async execute(context) {
        const classification = resolveOutputClassification(context.classification, context.inputArtifacts);
        const output = context.createArtifact({
          createdBy: context.createdBy,
          workflowId: context.workflow.id,
          classification,
          parentIds: context.inputArtifacts.map((artifact) => artifact.id),
          content: {
            schemaVersion: 'trustsignal.workflow.readiness_findings.v1',
            workflowId: context.workflow.id,
            stepId: context.step.id,
            findings: context.parameters.findings ?? [],
            evidenceReferences: context.inputArtifacts.map((artifact) => ({
              artifactId: artifact.id,
              hash: artifact.hash,
              relationship: 'source',
              classification: artifact.classification
            }))
          }
        });

        return { outputArtifactIds: [output.id] };
      }
    },
    {
      id: 'trustagents.readiness.summary',
      description: 'Builds a readiness summary artifact from findings and source evidence.',
      async execute(context) {
        const classification = resolveOutputClassification(context.classification, context.inputArtifacts);
        const output = context.createArtifact({
          createdBy: context.createdBy,
          workflowId: context.workflow.id,
          classification,
          parentIds: context.inputArtifacts.map((artifact) => artifact.id),
          content: {
            schemaVersion: 'trustsignal.workflow.readiness_summary.v1',
            workflowId: context.workflow.id,
            stepId: context.step.id,
            summary: context.parameters.summary ?? null,
            evidenceReferences: context.inputArtifacts.map((artifact) => ({
              artifactId: artifact.id,
              hash: artifact.hash,
              relationship: artifact.content && typeof artifact.content === 'object' && 'findings' in (artifact.content as Record<string, unknown>)
                ? 'finding'
                : 'source',
              classification: artifact.classification
            }))
          }
        });

        return { outputArtifactIds: [output.id] };
      }
    }
  ];

  return new Map(agents.map((agent) => [agent.id, agent]));
}

export class WorkflowService {
  private readonly agents: Map<string, AgentDefinition>;
  private readonly store: WorkflowStore;
  private readonly eventSink: WorkflowEventSink;

  constructor(
    agentRegistry = createBuiltInAgents(),
    dependencies: {
      store?: WorkflowStore;
      eventSink?: WorkflowEventSink;
    } = {}
  ) {
    this.agents = new Map(agentRegistry);
    this.store = dependencies.store ?? new InMemoryWorkflowStore();
    this.eventSink = dependencies.eventSink ?? new NoopWorkflowEventSink();
  }

  listAgents(): AgentDescriptor[] {
    return [...this.agents.values()].map((agent) => ({
      id: agent.id,
      description: agent.description
    }));
  }

  createWorkflow(createdBy: string): Workflow {
    const workflow: Workflow = {
      id: randomUUID(),
      createdAt: nowIso(),
      createdBy,
      status: 'pending'
    };

    this.store.setWorkflow(workflow);
    this.eventSink.record({
      type: 'workflow.created',
      workflowId: workflow.id,
      actor: createdBy,
      timestamp: workflow.createdAt
    });
    return workflow;
  }

  getWorkflowState(workflowId: string): WorkflowState | null {
    const workflow = this.store.getWorkflow(workflowId);
    if (!workflow) {
      return null;
    }

    const artifactIds = this.store.getArtifactIds(workflowId);
    const artifacts = artifactIds
      .map((artifactId) => this.store.getArtifact(artifactId))
      .filter((artifact): artifact is StoredArtifact => Boolean(artifact))
      .map((artifact) => ({
        id: artifact.id,
        hash: artifact.hash,
        createdAt: artifact.createdAt,
        createdBy: artifact.createdBy,
        parentIds: [...artifact.parentIds],
        workflowId: artifact.workflowId,
        classification: artifact.classification
      }));

    return {
      workflow,
      runs: this.store.getRuns(workflowId).map((run) => ({
        ...run,
        steps: run.steps.map((step) => ({ ...step }))
      })),
      artifacts,
      verifications: [...this.store.getVerifications(workflowId)],
      releaseDecisions: [...this.store.getReleaseDecisions(workflowId)]
    };
  }

  getEvidencePackage(workflowId: string): EvidencePackage | null {
    return this.store.getEvidencePackage(workflowId) ?? null;
  }

  createArtifact(input: {
    createdBy: string;
    workflowId: string;
    classification: ArtifactClassification;
    parentIds: string[];
    content: unknown;
  }): Artifact {
    const workflow = this.store.getWorkflow(input.workflowId);
    if (!workflow) {
      throw new WorkflowError('workflow_not_found');
    }

    const parentArtifacts = input.parentIds.map((artifactId) => this.getArtifactForWorkflow(input.workflowId, artifactId));
    const resolvedClassification = resolveOutputClassification(input.classification, parentArtifacts);

    const artifact: StoredArtifact = {
      id: randomUUID(),
      hash: keccak256Utf8(canonicalizeJson(input.content)),
      createdAt: nowIso(),
      createdBy: input.createdBy,
      parentIds: [...input.parentIds],
      workflowId: input.workflowId,
      classification: resolvedClassification,
      content: input.content
    };

    this.store.appendArtifact(input.workflowId, artifact);
    this.eventSink.record({
      type: 'workflow.artifact.created',
      workflowId: input.workflowId,
      artifactId: artifact.id,
      actor: input.createdBy,
      classification: artifact.classification,
      timestamp: artifact.createdAt
    });

    return {
      id: artifact.id,
      hash: artifact.hash,
      createdAt: artifact.createdAt,
      createdBy: artifact.createdBy,
      parentIds: [...artifact.parentIds],
      workflowId: artifact.workflowId,
      classification: artifact.classification
    };
  }

  verifyArtifact(workflowId: string, artifactId: string, actor = 'system'): VerificationRecord {
    const artifact = this.getArtifactForWorkflow(workflowId, artifactId);
    const recomputedHash = keccak256Utf8(canonicalizeJson(artifact.content));
    const verification: VerificationRecord = {
      artifactId: artifact.id,
      hash: artifact.hash,
      verified: recomputedHash === artifact.hash,
      timestamp: nowIso()
    };

    this.store.appendVerification(workflowId, verification);
    this.eventSink.record({
      type: 'workflow.artifact.verified',
      workflowId,
      artifactId,
      actor,
      timestamp: verification.timestamp,
      verified: verification.verified
    });

    return verification;
  }

  evaluateReleaseDecision(
    workflowId: string,
    artifactId: string,
    target: ReleaseTarget,
    actor = 'system'
  ): ReleaseDecision {
    const artifact = this.getArtifactForWorkflow(workflowId, artifactId);
    const decision = evaluateReleaseDecisionForArtifact({
      workflowId,
      artifactId,
      classification: artifact.classification,
      target
    });
    this.store.appendReleaseDecision(workflowId, decision);
    this.eventSink.record({
      type: 'workflow.release.evaluated',
      workflowId,
      artifactId,
      actor,
      target,
      timestamp: decision.timestamp,
      allowed: decision.allowed
    });

    return decision;
  }

  async runEnterpriseReadinessAuditWorkflow(request: ReadinessWorkflowRequest): Promise<{
    workflow: Workflow;
    run: AgentRun;
    sourceArtifacts: Artifact[];
    findingArtifact: Artifact;
    summaryArtifact: Artifact;
    evidencePackage: EvidencePackage;
    evidenceReferences: EvidenceReference[];
    verificationRecords: VerificationRecord[];
    releaseDecisions: ReleaseDecision[];
    result: {
      workflowId: string;
      conclusion: string;
      releaseGate: 'pass' | 'blocked';
      releaseDecisionCount: number;
    };
  }> {
    const workflow = this.createWorkflow(request.createdBy);
    const sourceArtifacts = request.sourceArtifacts.map((sourceArtifact) =>
      this.createArtifact({
        createdBy: request.createdBy,
        workflowId: workflow.id,
        classification: sourceArtifact.classification,
        parentIds: [],
        content: {
          schemaVersion: 'trustsignal.workflow.readiness_source.v1',
          sourceRef: sourceArtifact.sourceRef,
          name: sourceArtifact.name,
          content: sourceArtifact.content
        }
      })
    );

    const artifactIdBySourceRef = new Map<string, string>(
      request.sourceArtifacts.map((artifact, index) => [artifact.sourceRef, sourceArtifacts[index]!.id])
    );

    const normalizedFindings = request.findings.map((finding) => ({
      ...finding,
      evidenceArtifactIds: finding.evidenceSourceRefs.map((sourceRef) => {
        const artifactId = artifactIdBySourceRef.get(sourceRef);
        if (!artifactId) {
          throw new WorkflowError('unknown_source_ref', `unknown_source_ref:${sourceRef}`, { sourceRef });
        }
        return artifactId;
      })
    }));

    const run = await this.runWorkflow(workflow.id, {
      createdBy: request.createdBy,
      steps: [
        {
          agentId: 'trustagents.readiness.findings',
          inputArtifactIds: sourceArtifacts.map((artifact) => artifact.id),
          parameters: {
            findings: normalizedFindings
          }
        }
      ]
    });

    const findingArtifactId = run.steps[0]?.outputArtifactIds[0];
    if (!findingArtifactId) {
      throw new WorkflowError('workflow_run_failed');
    }

    const findingsRun = await this.runWorkflow(workflow.id, {
      createdBy: request.createdBy,
      steps: [
        {
          agentId: 'trustagents.readiness.summary',
          inputArtifactIds: [...sourceArtifacts.map((artifact) => artifact.id), findingArtifactId],
          parameters: {
            summary: request.summary
          }
        }
      ]
    });

    const summaryArtifactId = findingsRun.steps[0]?.outputArtifactIds[0];
    if (!summaryArtifactId) {
      throw new WorkflowError('workflow_run_failed');
    }

    const combinedRun: AgentRun = {
      id: findingsRun.id,
      workflowId: workflow.id,
      steps: [...run.steps, ...findingsRun.steps]
    };

    const findingArtifact = this.toArtifact(this.getArtifactForWorkflow(workflow.id, findingArtifactId));
    const summaryArtifact = this.toArtifact(this.getArtifactForWorkflow(workflow.id, summaryArtifactId));

    const verificationRecords = [
      this.verifyArtifact(workflow.id, findingArtifact.id, request.createdBy),
      this.verifyArtifact(workflow.id, summaryArtifact.id, request.createdBy)
    ];

    const releaseTargets = request.releaseTargets ?? {
      findings: 'internal_draft' as const,
      summary: 'customer_shareable' as const
    };
    const releaseDecisions = [
      this.evaluateReleaseDecision(workflow.id, findingArtifact.id, releaseTargets.findings, request.createdBy),
      this.evaluateReleaseDecision(workflow.id, summaryArtifact.id, releaseTargets.summary, request.createdBy)
    ];

    const evidenceReferences: EvidenceReference[] = [
      ...sourceArtifacts.map((artifact) => ({
        artifactId: artifact.id,
        hash: artifact.hash,
        relationship: 'source' as const,
        classification: artifact.classification
      })),
      {
        artifactId: findingArtifact.id,
        hash: findingArtifact.hash,
        relationship: 'finding' as const,
        classification: findingArtifact.classification
      },
      {
        artifactId: summaryArtifact.id,
        hash: summaryArtifact.hash,
        relationship: 'summary' as const,
        classification: summaryArtifact.classification
      }
    ];

    const evidencePackage = this.buildEvidencePackage({
      workflowId: workflow.id,
      summaryArtifactId: summaryArtifact.id,
      findingsArtifactId: findingArtifact.id,
      artifacts: [...sourceArtifacts, findingArtifact, summaryArtifact],
      evidenceReferences,
      verificationRecords,
      releaseDecisions,
      unsupportedClaims: request.unsupportedClaims,
      unverifiedControls: request.unverifiedControls
    });
    this.store.setEvidencePackage(workflow.id, evidencePackage);
    this.eventSink.record({
      type: 'workflow.evidence_package.created',
      workflowId: workflow.id,
      packageId: evidencePackage.id,
      actor: request.createdBy,
      classification: evidencePackage.classification,
      timestamp: evidencePackage.createdAt
    });

    return {
      workflow,
      run: combinedRun,
      sourceArtifacts,
      findingArtifact,
      summaryArtifact,
      evidencePackage,
      evidenceReferences,
      verificationRecords,
      releaseDecisions,
      result: {
        workflowId: workflow.id,
        conclusion: request.summary.conclusion,
        releaseGate: releaseDecisions.every((decision) => decision.allowed) ? 'pass' : 'blocked',
        releaseDecisionCount: releaseDecisions.length
      }
    };
  }

  async runWorkflow(workflowId: string, request: WorkflowRunRequest): Promise<AgentRun> {
    const workflow = this.store.getWorkflow(workflowId);
    if (!workflow) {
      throw new WorkflowError('workflow_not_found');
    }

    workflow.status = 'running';
    const run: AgentRun = {
      id: randomUUID(),
      workflowId,
      steps: request.steps.map((stepRequest) => ({
        id: randomUUID(),
        workflowId,
        agentId: stepRequest.agentId,
        inputArtifactIds: [...stepRequest.inputArtifactIds],
        outputArtifactIds: [],
        status: 'pending'
      }))
    };

    this.store.appendRun(workflowId, run);
    this.eventSink.record({
      type: 'workflow.run.started',
      workflowId,
      runId: run.id,
      actor: request.createdBy,
      timestamp: nowIso()
    });

    try {
      for (let index = 0; index < request.steps.length; index += 1) {
        const stepRequest = request.steps[index] as WorkflowRunStepRequest;
        const step = run.steps[index]!;
        const agent = this.agents.get(stepRequest.agentId);
        if (!agent) {
          throw new WorkflowError('agent_not_found');
        }

        const inputArtifacts = stepRequest.inputArtifactIds.map((artifactId) => this.getArtifactForWorkflow(workflowId, artifactId));
        step.status = 'running';

        const result = await agent.execute({
          workflow,
          step,
          createdBy: request.createdBy,
          inputArtifacts,
          classification: stepRequest.classification,
          parameters: stepRequest.parameters ?? {},
          createArtifact: (artifactInput) => this.createArtifact(artifactInput),
          verifyArtifact: (artifactId) => this.verifyArtifact(workflowId, artifactId, request.createdBy)
        });

        step.outputArtifactIds = [...result.outputArtifactIds];
        step.status = 'completed';
      }

      workflow.status = 'completed';
      this.eventSink.record({
        type: 'workflow.run.completed',
        workflowId,
        runId: run.id,
        actor: request.createdBy,
        timestamp: nowIso()
      });
      return {
        ...run,
        steps: run.steps.map((step) => ({ ...step }))
      };
    } catch (error) {
      const currentStep = run.steps.find((step) => step.status === 'running' || step.status === 'pending');
      if (currentStep && currentStep.status !== 'completed') {
        currentStep.status = 'failed';
      }
      workflow.status = 'failed';
      this.eventSink.record({
        type: 'workflow.run.failed',
        workflowId,
        runId: run.id,
        actor: request.createdBy,
        timestamp: nowIso(),
        reason: error instanceof Error ? error.message : 'workflow_run_failed'
      });
      throw error;
    }
  }

  private getArtifactForWorkflow(workflowId: string, artifactId: string): StoredArtifact {
    const artifact = this.store.getArtifact(artifactId);
    if (!artifact || artifact.workflowId !== workflowId) {
      throw new WorkflowError('artifact_not_found');
    }
    return artifact;
  }

  private toArtifact(artifact: StoredArtifact): Artifact {
    return {
      id: artifact.id,
      hash: artifact.hash,
      createdAt: artifact.createdAt,
      createdBy: artifact.createdBy,
      parentIds: [...artifact.parentIds],
      workflowId: artifact.workflowId,
      classification: artifact.classification
    };
  }

  private buildEvidencePackage(input: {
    workflowId: string;
    summaryArtifactId: string;
    findingsArtifactId: string;
    artifacts: Artifact[];
    evidenceReferences: EvidenceReference[];
    verificationRecords: VerificationRecord[];
    releaseDecisions: ReleaseDecision[];
    unsupportedClaims: string[];
    unverifiedControls: string[];
  }): EvidencePackage {
    const classification = input.artifacts.some((artifact) =>
      artifact.classification === 'audit_private' || artifact.classification === 'restricted'
    )
      ? 'audit_private'
      : 'internal';

    return {
      id: randomUUID(),
      workflowId: input.workflowId,
      createdAt: nowIso(),
      summaryArtifactId: input.summaryArtifactId,
      findingsArtifactId: input.findingsArtifactId,
      artifactIds: input.artifacts.map((artifact) => artifact.id),
      evidenceReferences: input.evidenceReferences,
      verificationRecords: input.verificationRecords,
      releaseDecisions: input.releaseDecisions,
      unsupportedClaims: [...input.unsupportedClaims],
      unverifiedControls: [...input.unverifiedControls],
      classification
    };
  }
}
