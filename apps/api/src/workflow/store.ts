import type {
  AgentRun,
  EvidencePackage,
  ReleaseDecision,
  StoredArtifact,
  VerificationRecord,
  Workflow
} from './types.js';

export interface WorkflowStore {
  getWorkflow(workflowId: string): Workflow | undefined;
  setWorkflow(workflow: Workflow): void;
  getRuns(workflowId: string): AgentRun[];
  appendRun(workflowId: string, run: AgentRun): void;
  getArtifact(artifactId: string): StoredArtifact | undefined;
  appendArtifact(workflowId: string, artifact: StoredArtifact): void;
  getArtifactIds(workflowId: string): string[];
  getVerifications(workflowId: string): VerificationRecord[];
  appendVerification(workflowId: string, verification: VerificationRecord): void;
  getReleaseDecisions(workflowId: string): ReleaseDecision[];
  appendReleaseDecision(workflowId: string, decision: ReleaseDecision): void;
  getEvidencePackage(workflowId: string): EvidencePackage | undefined;
  setEvidencePackage(workflowId: string, evidencePackage: EvidencePackage): void;
}

export class InMemoryWorkflowStore implements WorkflowStore {
  private readonly workflows = new Map<string, Workflow>();
  private readonly runs = new Map<string, AgentRun[]>();
  private readonly artifacts = new Map<string, StoredArtifact>();
  private readonly artifactIdsByWorkflow = new Map<string, string[]>();
  private readonly verifications = new Map<string, VerificationRecord[]>();
  private readonly releaseDecisions = new Map<string, ReleaseDecision[]>();
  private readonly evidencePackages = new Map<string, EvidencePackage>();

  getWorkflow(workflowId: string): Workflow | undefined {
    return this.workflows.get(workflowId);
  }

  setWorkflow(workflow: Workflow): void {
    this.workflows.set(workflow.id, workflow);
    this.runs.set(workflow.id, this.runs.get(workflow.id) ?? []);
    this.artifactIdsByWorkflow.set(workflow.id, this.artifactIdsByWorkflow.get(workflow.id) ?? []);
    this.verifications.set(workflow.id, this.verifications.get(workflow.id) ?? []);
    this.releaseDecisions.set(workflow.id, this.releaseDecisions.get(workflow.id) ?? []);
  }

  getRuns(workflowId: string): AgentRun[] {
    return this.runs.get(workflowId) ?? [];
  }

  appendRun(workflowId: string, run: AgentRun): void {
    this.runs.set(workflowId, [...this.getRuns(workflowId), run]);
  }

  getArtifact(artifactId: string): StoredArtifact | undefined {
    return this.artifacts.get(artifactId);
  }

  appendArtifact(workflowId: string, artifact: StoredArtifact): void {
    this.artifacts.set(artifact.id, artifact);
    this.artifactIdsByWorkflow.set(workflowId, [...this.getArtifactIds(workflowId), artifact.id]);
  }

  getArtifactIds(workflowId: string): string[] {
    return this.artifactIdsByWorkflow.get(workflowId) ?? [];
  }

  getVerifications(workflowId: string): VerificationRecord[] {
    return this.verifications.get(workflowId) ?? [];
  }

  appendVerification(workflowId: string, verification: VerificationRecord): void {
    this.verifications.set(workflowId, [...this.getVerifications(workflowId), verification]);
  }

  getReleaseDecisions(workflowId: string): ReleaseDecision[] {
    return this.releaseDecisions.get(workflowId) ?? [];
  }

  appendReleaseDecision(workflowId: string, decision: ReleaseDecision): void {
    this.releaseDecisions.set(workflowId, [...this.getReleaseDecisions(workflowId), decision]);
  }

  getEvidencePackage(workflowId: string): EvidencePackage | undefined {
    return this.evidencePackages.get(workflowId);
  }

  setEvidencePackage(workflowId: string, evidencePackage: EvidencePackage): void {
    this.evidencePackages.set(workflowId, evidencePackage);
  }
}
