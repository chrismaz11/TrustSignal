import type {
  ArtifactClassification,
  ReleaseDecision,
  ReleaseTarget,
  StoredArtifact
} from './types.js';
import { WorkflowError } from './errors.js';

export const classificationRank: Record<ArtifactClassification, number> = {
  public: 0,
  internal: 1,
  audit_private: 2,
  restricted: 3
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function maxClassification(classifications: ArtifactClassification[]): ArtifactClassification {
  return classifications.reduce<ArtifactClassification>((current, candidate) => {
    return classificationRank[candidate] > classificationRank[current] ? candidate : current;
  }, 'public');
}

export function resolveOutputClassification(
  requested: ArtifactClassification | undefined,
  parentArtifacts: StoredArtifact[]
): ArtifactClassification {
  if (parentArtifacts.length === 0) {
    return requested ?? 'internal';
  }

  const inherited = maxClassification(parentArtifacts.map((artifact) => artifact.classification));
  if (!requested) {
    return inherited;
  }

  if (classificationRank[requested] < classificationRank[inherited]) {
    throw new WorkflowError('artifact_classification_downgrade_forbidden');
  }

  return requested;
}

export function evaluateReleaseDecisionForArtifact(
  input: {
    workflowId: string;
    artifactId: string;
    classification: ArtifactClassification;
    target: ReleaseTarget;
  }
): ReleaseDecision {
  let allowed = false;
  let reason = 'release_blocked_by_policy';

  if (input.target === 'customer_shareable') {
    allowed = input.classification === 'public';
    reason = allowed
      ? 'public_artifact_customer_shareable'
      : 'customer_shareable_requires_public_classification';
  } else if (input.target === 'internal_draft') {
    allowed = input.classification === 'public' || input.classification === 'internal';
    reason = allowed
      ? 'internal_artifact_allowed'
      : 'internal_draft_blocks_audit_private_and_restricted';
  } else if (input.target === 'audit_private') {
    allowed = input.classification !== 'restricted';
    reason = allowed
      ? 'audit_private_release_allowed'
      : 'restricted_artifacts_cannot_be_exported';
  } else {
    throw new WorkflowError('invalid_release_target');
  }

  return {
    workflowId: input.workflowId,
    artifactId: input.artifactId,
    classification: input.classification,
    target: input.target,
    allowed,
    reason,
    timestamp: nowIso()
  };
}
