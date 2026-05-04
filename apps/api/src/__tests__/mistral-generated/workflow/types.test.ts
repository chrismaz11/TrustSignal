import { describe, it, expect } from 'vitest';
import {
  workflowStatusSchema,
  artifactClassificationSchema,
  workflowStepStatusSchema,
  workflowCreateRequestSchema,
  workflowParamsSchema,
  workflowArtifactParamsSchema,
  workflowArtifactCreateSchema,
  workflowRunStepSchema,
  workflowRunRequestSchema,
  evidenceReferenceRelationshipSchema,
  releaseTargetSchema,
  readinessConclusionSchema,
  readinessFindingSeveritySchema,
  readinessFindingStatusSchema,
  readinessSourceArtifactSchema,
  readinessFindingSchema,
  readinessSummarySchema,
  readinessReleaseTargetsSchema,
  readinessWorkflowRequestSchema
} from '../../../workflow/types.js';

describe('workflow types', () => {
  describe('enums', () => {
    it('should validate workflowStatusSchema', () => {
      expect(workflowStatusSchema.parse('pending')).toBe('pending');
      expect(workflowStatusSchema.parse('running')).toBe('running');
      expect(workflowStatusSchema.parse('completed')).toBe('completed');
      expect(workflowStatusSchema.parse('failed')).toBe('failed');
      expect(() => workflowStatusSchema.parse('invalid')).toThrow();
    });

    it('should validate artifactClassificationSchema', () => {
      expect(artifactClassificationSchema.parse('public')).toBe('public');
      expect(artifactClassificationSchema.parse('internal')).toBe('internal');
      expect(artifactClassificationSchema.parse('audit_private')).toBe('audit_private');
      expect(artifactClassificationSchema.parse('restricted')).toBe('restricted');
      expect(() => artifactClassificationSchema.parse('invalid')).toThrow();
    });

    it('should validate workflowStepStatusSchema', () => {
      expect(workflowStepStatusSchema.parse('pending')).toBe('pending');
      expect(workflowStepStatusSchema.parse('running')).toBe('running');
      expect(workflowStepStatusSchema.parse('completed')).toBe('completed');
      expect(workflowStepStatusSchema.parse('failed')).toBe('failed');
      expect(() => workflowStepStatusSchema.parse('invalid')).toThrow();
    });

    it('should validate evidenceReferenceRelationshipSchema', () => {
      expect(evidenceReferenceRelationshipSchema.parse('source')).toBe('source');
      expect(evidenceReferenceRelationshipSchema.parse('finding')).toBe('finding');
      expect(evidenceReferenceRelationshipSchema.parse('summary')).toBe('summary');
      expect(() => evidenceReferenceRelationshipSchema.parse('invalid')).toThrow();
    });

    it('should validate releaseTargetSchema', () => {
      expect(releaseTargetSchema.parse('internal_draft')).toBe('internal_draft');
      expect(releaseTargetSchema.parse('customer_shareable')).toBe('customer_shareable');
      expect(releaseTargetSchema.parse('audit_private')).toBe('audit_private');
      expect(() => releaseTargetSchema.parse('invalid')).toThrow();
    });

    it('should validate readinessConclusionSchema', () => {
      expect(readinessConclusionSchema.parse('go')).toBe('go');
      expect(readinessConclusionSchema.parse('conditional_go')).toBe('conditional_go');
      expect(readinessConclusionSchema.parse('no_go')).toBe('no_go');
      expect(() => readinessConclusionSchema.parse('invalid')).toThrow();
    });

    it('should validate readinessFindingSeveritySchema', () => {
      expect(readinessFindingSeveritySchema.parse('low')).toBe('low');
      expect(readinessFindingSeveritySchema.parse('medium')).toBe('medium');
      expect(readinessFindingSeveritySchema.parse('high')).toBe('high');
      expect(readinessFindingSeveritySchema.parse('critical')).toBe('critical');
      expect(() => readinessFindingSeveritySchema.parse('invalid')).toThrow();
    });

    it('should validate readinessFindingStatusSchema', () => {
      expect(readinessFindingStatusSchema.parse('open')).toBe('open');
      expect(readinessFindingStatusSchema.parse('accepted_risk')).toBe('accepted_risk');
      expect(readinessFindingStatusSchema.parse('resolved')).toBe('resolved');
      expect(() => readinessFindingStatusSchema.parse('invalid')).toThrow();
    });
  });

  describe('request schemas', () => {
    it('should validate workflowCreateRequestSchema', () => {
      const valid = { createdBy: 'user1' };
      expect(workflowCreateRequestSchema.parse(valid)).toEqual(valid);

      expect(() => workflowCreateRequestSchema.parse({})).toThrow();
      expect(() => workflowCreateRequestSchema.parse({ createdBy: '' })).toThrow();
      expect(() => workflowCreateRequestSchema.parse({ createdBy: 'a'.repeat(129) })).toThrow();
      expect(() => workflowCreateRequestSchema.parse({ createdBy: 'user1', extra: 'field' })).toThrow();
    });

    it('should validate workflowParamsSchema', () => {
      const valid = { workflowId: '550e8400-e29b-41d4-a716-446655440000' };
      expect(workflowParamsSchema.parse(valid)).toEqual(valid);

      expect(() => workflowParamsSchema.parse({})).toThrow();
      expect(() => workflowParamsSchema.parse({ workflowId: 'invalid' })).toThrow();
      expect(() => workflowParamsSchema.parse({ workflowId: '550e8400-e29b-41d4-a716-446655440000', extra: 'field' })).toThrow();
    });

    it('should validate workflowArtifactParamsSchema', () => {
      const valid = {
        workflowId: '550e8400-e29b-41d4-a716-446655440000',
        artifactId: '550e8400-e29b-41d4-a716-446655440000'
      };
      expect(workflowArtifactParamsSchema.parse(valid)).toEqual(valid);

      expect(() => workflowArtifactParamsSchema.parse({})).toThrow();
      expect(() => workflowArtifactParamsSchema.parse({ workflowId: 'invalid', artifactId: '550e8400-e29b-41d4-a716-446655440000' })).toThrow();
      expect(() => workflowArtifactParamsSchema.parse({ workflowId: '550e8400-e29b-41d4-a716-446655440000', artifactId: 'invalid' })).toThrow();
    });

    it('should validate workflowArtifactCreateSchema', () => {
      const valid = {
        createdBy: 'user1',
        parentIds: [],
        classification: 'public',
        content: { key: 'value' }
      };
      expect(workflowArtifactCreateSchema.parse(valid)).toEqual(valid);

      expect(() => workflowArtifactCreateSchema.parse({})).toThrow();
      expect(() => workflowArtifactCreateSchema.parse({ createdBy: '', parentIds: [], classification: 'public', content: {} })).toThrow();
      expect(() => workflowArtifactCreateSchema.parse({ createdBy: 'user1', parentIds: ['invalid'], classification: 'public', content: {} })).toThrow();
    });

    it('should validate workflowRunStepSchema', () => {
      const valid = {
        agentId: 'agent1',
        inputArtifactIds: [],
        classification: 'public',
        parameters: { key: 'value' }
      };
      expect(workflowRunStepSchema.parse(valid)).toEqual(valid);

      expect(() => workflowRunStepSchema.parse({})).toThrow();
      expect(() => workflowRunStepSchema.parse({ agentId: '', inputArtifactIds: [] })).toThrow();
      expect(() => workflowRunStepSchema.parse({ agentId: 'agent1', inputArtifactIds: ['invalid'] })).toThrow();
    });

    it('should validate workflowRunRequestSchema', () => {
      const valid = {
        createdBy: 'user1',
        steps: [
          { agentId: 'agent1', inputArtifactIds: [] }
        ]
      };
      expect(workflowRunRequestSchema.parse(valid)).toEqual(valid);

      expect(() => workflowRunRequestSchema.parse({})).toThrow();
      expect(() => workflowRunRequestSchema.parse({ createdBy: 'user1', steps: [] })).toThrow();
      expect(() => workflowRunRequestSchema.parse({ createdBy: 'user1', steps: [{ agentId: '', inputArtifactIds: [] }] })).toThrow();
    });

    it('should validate readinessSourceArtifactSchema', () => {
      const valid = {
        sourceRef: 'ref1',
        name: 'name1',
        classification: 'public',
        content: { key: 'value' }
      };
      expect(readinessSourceArtifactSchema.parse(valid)).toEqual(valid);

      expect(() => readinessSourceArtifactSchema.parse({})).toThrow();
      expect(() => readinessSourceArtifactSchema.parse({ sourceRef: '', name: 'name1', classification: 'public', content: {} })).toThrow();
      expect(() => readinessSourceArtifactSchema.parse({ sourceRef: 'ref1', name: '', classification: 'public', content: {} })).toThrow();
    });

    it('should validate readinessFindingSchema', () => {
      const valid = {
        id: 'finding1',
        title: 'title1',
        severity: 'low',
        status: 'open',
        details: 'details1',
        evidenceSourceRefs: ['ref1']
      };
      expect(readinessFindingSchema.parse(valid)).toEqual(valid);

      expect(() => readinessFindingSchema.parse({})).toThrow();
      expect(() => readinessFindingSchema.parse({ id: '', title: 'title1', severity: 'low', status: 'open', details: 'details1', evidenceSourceRefs: ['ref1'] })).toThrow();
      expect(() => readinessFindingSchema.parse({ id: 'finding1', title: '', severity: 'low', status: 'open', details: 'details1', evidenceSourceRefs: ['ref1'] })).toThrow();
      expect(() => readinessFindingSchema.parse({ id: 'finding1', title: 'title1', severity: 'low', status: 'open', details: '', evidenceSourceRefs: ['ref1'] })).toThrow();
      expect(() => readinessFindingSchema.parse({ id: 'finding1', title: 'title1', severity: 'low', status: 'open', details: 'details1', evidenceSourceRefs: [] })).toThrow();
    });

    it('should validate readinessSummarySchema', () => {
      const valid = {
        conclusion: 'go',
        highlights: ['highlight1']
      };
      expect(readinessSummarySchema.parse(valid)).toEqual(valid);

      expect(() => readinessSummarySchema.parse({})).toThrow();
      expect(() => readinessSummarySchema.parse({ conclusion: 'go', highlights: [] })).toThrow();
      expect(() => readinessSummarySchema.parse({ conclusion: 'go', highlights: [''] })).toThrow();
    });

    it('should validate readinessReleaseTargetsSchema', () => {
      const valid = {
        findings: 'internal_draft',
        summary: 'customer_shareable'
      };
      expect(readinessReleaseTargetsSchema.parse(valid)).toEqual(valid);

      expect(readinessReleaseTargetsSchema.parse({})).toEqual({
        findings: 'internal_draft',
        summary: 'customer_shareable'
      });

      expect(() => readinessReleaseTargetsSchema.parse({ findings: 'invalid' })).toThrow();
    });

    it('should validate readinessWorkflowRequestSchema', () => {
      const valid = {
        createdBy: 'user1',
        sourceArtifacts: [
          { sourceRef: 'ref1', name: 'name1', classification: 'public', content: {} }
        ],
        findings: [
          { id: 'finding1', title: 'title1', severity: 'low', status: 'open', details: 'details1', evidenceSourceRefs: ['ref1'] }
        ],
        summary: { conclusion: 'go', highlights: ['highlight1'] }
      };
      expect(readinessWorkflowRequestSchema.parse(valid)).toEqual(valid);

      expect(() => readinessWorkflowRequestSchema.parse({})).toThrow();
      expect(() => readinessWorkflowRequestSchema.parse({ createdBy: 'user1', sourceArtifacts: [], findings: [], summary: { conclusion: 'go', highlights: ['highlight1'] } })).toThrow();
    });

    it('should reject duplicate sourceRefs in readinessWorkflowRequestSchema', () => {
      const invalid = {
        createdBy: 'user1',
        sourceArtifacts: [
          { sourceRef: 'ref1', name: 'name1', classification: 'public', content: {} },
          { sourceRef: 'ref1', name: 'name2', classification: 'public', content: {} }
        ],
        findings: [
          { id: 'finding1', title: 'title1', severity: 'low', status: 'open', details: 'details1', evidenceSourceRefs: ['ref1'] }
        ],
        summary: { conclusion: 'go', highlights: ['highlight1'] }
      };
      expect(() => readinessWorkflowRequestSchema.parse(invalid)).toThrow();
    });
  });
});
