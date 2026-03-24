import { z } from 'zod';

export const workflowStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);
export const artifactClassificationSchema = z.enum(['public', 'internal', 'audit_private', 'restricted']);
export const workflowStepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed']);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;
export type ArtifactClassification = z.infer<typeof artifactClassificationSchema>;
export type WorkflowStepStatus = z.infer<typeof workflowStepStatusSchema>;

export interface Workflow {
  id: string;
  createdAt: string;
  createdBy: string;
  status: WorkflowStatus;
}

export interface Artifact {
  id: string;
  hash: string;
  createdAt: string;
  createdBy: string;
  parentIds: string[];
  workflowId: string;
  classification: ArtifactClassification;
}

export interface WorkflowStep {
  id: string;
  workflowId: string;
  agentId: string;
  inputArtifactIds: string[];
  outputArtifactIds: string[];
  status: WorkflowStepStatus;
}

export interface AgentRun {
  id: string;
  workflowId: string;
  steps: WorkflowStep[];
}

export interface VerificationRecord {
  artifactId: string;
  hash: string;
  verified: boolean;
  timestamp: string;
}

export interface EvidenceReference {
  artifactId: string;
  hash: string;
  relationship: 'source' | 'finding' | 'summary';
  classification: ArtifactClassification;
}

export type EvidencePackageClassification = 'internal' | 'audit_private';

export interface EvidencePackage {
  id: string;
  workflowId: string;
  createdAt: string;
  summaryArtifactId: string;
  findingsArtifactId: string;
  artifactIds: string[];
  evidenceReferences: EvidenceReference[];
  verificationRecords: VerificationRecord[];
  releaseDecisions: ReleaseDecision[];
  unsupportedClaims: string[];
  unverifiedControls: string[];
  classification: EvidencePackageClassification;
}

export type ReleaseTarget = 'internal_draft' | 'customer_shareable' | 'audit_private';

export interface ReleaseDecision {
  workflowId: string;
  artifactId: string;
  classification: ArtifactClassification;
  target: ReleaseTarget;
  allowed: boolean;
  reason: string;
  timestamp: string;
}

export interface StoredArtifact extends Artifact {
  content: unknown;
}

export interface AgentDescriptor {
  id: string;
  description: string;
}

export const workflowCreateRequestSchema = z.object({
  createdBy: z.string().trim().min(1).max(128)
}).strict();

export const workflowParamsSchema = z.object({
  workflowId: z.string().uuid()
}).strict();

export const workflowArtifactParamsSchema = z.object({
  workflowId: z.string().uuid(),
  artifactId: z.string().uuid()
}).strict();

export const workflowArtifactCreateSchema = z.object({
  createdBy: z.string().trim().min(1).max(128),
  parentIds: z.array(z.string().uuid()).default([]),
  classification: artifactClassificationSchema,
  content: z.unknown()
}).strict();

export const workflowRunStepSchema = z.object({
  agentId: z.string().trim().min(1).max(128),
  inputArtifactIds: z.array(z.string().uuid()).default([]),
  classification: artifactClassificationSchema.optional(),
  parameters: z.record(z.string(), z.unknown()).optional()
}).strict();

export const workflowRunRequestSchema = z.object({
  createdBy: z.string().trim().min(1).max(128),
  steps: z.array(workflowRunStepSchema).min(1)
}).strict();

export const evidenceReferenceRelationshipSchema = z.enum(['source', 'finding', 'summary']);
export const releaseTargetSchema = z.enum(['internal_draft', 'customer_shareable', 'audit_private']);
export const readinessConclusionSchema = z.enum(['go', 'conditional_go', 'no_go']);
export const readinessFindingSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const readinessFindingStatusSchema = z.enum(['open', 'accepted_risk', 'resolved']);

export const readinessSourceArtifactSchema = z.object({
  sourceRef: z.string().trim().min(1).max(128),
  name: z.string().trim().min(1).max(256),
  classification: artifactClassificationSchema,
  content: z.unknown()
}).strict();

export const readinessFindingSchema = z.object({
  id: z.string().trim().min(1).max(128),
  title: z.string().trim().min(1).max(256),
  severity: readinessFindingSeveritySchema,
  status: readinessFindingStatusSchema,
  details: z.string().trim().min(1).max(4000),
  evidenceSourceRefs: z.array(z.string().trim().min(1).max(128)).min(1)
}).strict();

export const readinessSummarySchema = z.object({
  conclusion: readinessConclusionSchema,
  highlights: z.array(z.string().trim().min(1).max(512)).min(1)
}).strict();

const readinessReleaseTargetsObjectSchema = z.object({
  findings: releaseTargetSchema.default('internal_draft'),
  summary: releaseTargetSchema.default('customer_shareable')
}).strict();

export const readinessReleaseTargetsSchema = readinessReleaseTargetsObjectSchema.default({
  findings: 'internal_draft',
  summary: 'customer_shareable'
});

export const readinessWorkflowRequestSchema = z.object({
  createdBy: z.string().trim().min(1).max(128),
  sourceArtifacts: z.array(readinessSourceArtifactSchema).min(1),
  findings: z.array(readinessFindingSchema).min(1),
  summary: readinessSummarySchema,
  unsupportedClaims: z.array(z.string().trim().min(1).max(512)).default([]),
  unverifiedControls: z.array(z.string().trim().min(1).max(256)).default([]),
  releaseTargets: readinessReleaseTargetsSchema.optional()
}).strict().superRefine((value, context) => {
  const seenSourceRefs = new Set<string>();
  for (const [index, sourceArtifact] of value.sourceArtifacts.entries()) {
    if (seenSourceRefs.has(sourceArtifact.sourceRef)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['sourceArtifacts', index, 'sourceRef'],
        message: 'sourceRef must be unique within a workflow request'
      });
    }
    seenSourceRefs.add(sourceArtifact.sourceRef);
  }
});

export type WorkflowCreateRequest = z.infer<typeof workflowCreateRequestSchema>;
export type WorkflowArtifactCreateRequest = z.infer<typeof workflowArtifactCreateSchema>;
export type WorkflowRunRequest = z.infer<typeof workflowRunRequestSchema>;
export type WorkflowRunStepRequest = z.infer<typeof workflowRunStepSchema>;
export type ReadinessWorkflowRequest = z.infer<typeof readinessWorkflowRequestSchema>;
