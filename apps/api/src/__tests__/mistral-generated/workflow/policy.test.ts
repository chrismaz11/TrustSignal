import { describe, it, expect } from 'vitest';
import {
  classificationRank,
  maxClassification,
  resolveOutputClassification,
  evaluateReleaseDecisionForArtifact,
  nowIso
} from '../../../workflow/policy.js';
import { WorkflowError } from '../../../workflow/errors.js';

describe('workflow policy', () => {
  describe('classificationRank', () => {
    it('should have correct ranking', () => {
      expect(classificationRank.public).toBe(0);
      expect(classificationRank.internal).toBe(1);
      expect(classificationRank.audit_private).toBe(2);
      expect(classificationRank.restricted).toBe(3);
    });
  });

  describe('maxClassification', () => {
    it('should return highest classification', () => {
      expect(maxClassification(['public', 'internal'])).toBe('internal');
      expect(maxClassification(['public', 'restricted'])).toBe('restricted');
      expect(maxClassification(['audit_private', 'restricted'])).toBe('restricted');
    });

    it('should return public for empty array', () => {
      expect(maxClassification([])).toBe('public');
    });
  });

  describe('resolveOutputClassification', () => {
    const mockArtifact = (classification: string) => ({
      id: 'artifact1',
      hash: 'hash1',
      createdAt: '2024-01-01T00:00:00Z',
      createdBy: 'user1',
      parentIds: [],
      workflowId: 'workflow1',
      classification
    });

    it('should return internal for no parents and no requested', () => {
      const result = resolveOutputClassification(undefined, []);
      expect(result).toBe('internal');
    });

    it('should return requested classification when no parents', () => {
      const result = resolveOutputClassification('public', []);
      expect(result).toBe('public');
    });

    it('should inherit from single parent', () => {
      const parent = mockArtifact('internal');
      const result = resolveOutputClassification(undefined, [parent]);
      expect(result).toBe('internal');
    });

    it('should inherit highest from multiple parents', () => {
      const parents = [mockArtifact('public'), mockArtifact('audit_private')];
      const result = resolveOutputClassification(undefined, parents);
      expect(result).toBe('audit_private');
    });

    it('should allow upgrading classification', () => {
      const parent = mockArtifact('public');
      const result = resolveOutputClassification('internal', [parent]);
      expect(result).toBe('internal');
    });

    it('should throw when downgrading classification', () => {
      const parent = mockArtifact('restricted');
      expect(() => resolveOutputClassification('public', [parent])).toThrow(WorkflowError);
    });
  });

  describe('evaluateReleaseDecisionForArtifact', () => {
    it('should allow public for customer_shareable', () => {
      const result = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'public',
        target: 'customer_shareable'
      });
      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('public_artifact_customer_shareable');
    });

    it('should block non-public for customer_shareable', () => {
      const result = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'internal',
        target: 'customer_shareable'
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('customer_shareable_requires_public_classification');
    });

    it('should allow public and internal for internal_draft', () => {
      const result1 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'public',
        target: 'internal_draft'
      });
      expect(result1.allowed).toBe(true);

      const result2 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'internal',
        target: 'internal_draft'
      });
      expect(result2.allowed).toBe(true);
    });

    it('should block audit_private and restricted for internal_draft', () => {
      const result1 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'audit_private',
        target: 'internal_draft'
      });
      expect(result1.allowed).toBe(false);

      const result2 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'restricted',
        target: 'internal_draft'
      });
      expect(result2.allowed).toBe(false);
    });

    it('should allow all except restricted for audit_private', () => {
      const result1 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'public',
        target: 'audit_private'
      });
      expect(result1.allowed).toBe(true);

      const result2 = evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'restricted',
        target: 'audit_private'
      });
      expect(result2.allowed).toBe(false);
    });

    it('should throw for invalid release target', () => {
      expect(() => evaluateReleaseDecisionForArtifact({
        workflowId: 'workflow1',
        artifactId: 'artifact1',
        classification: 'public',
        target: 'invalid' as any
      })).toThrow(WorkflowError);
    });
  });

  describe('nowIso', () => {
    it('should return current time in ISO format', () => {
      const result = nowIso();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
    });
  });
});
