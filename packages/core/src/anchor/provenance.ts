import { keccak256, toUtf8Bytes } from 'ethers';

import { canonicalizeJson } from '../canonicalize.js';
import { ZKPAttestation } from '../zkp/types.js';

export const ANCHOR_SUBJECT_VERSION = 'trustsignal.anchor_subject.v1' as const;

export interface AnchorSubject {
  version: typeof ANCHOR_SUBJECT_VERSION;
  hash: string;
  receiptHash: string;
  scheme?: ZKPAttestation['scheme'];
  status?: ZKPAttestation['status'];
  backend?: ZKPAttestation['backend'];
  circuitId?: string;
  documentDigest?: string;
  documentCommitment?: string;
  schemaVersion?: string;
  documentWitnessMode?: string;
  proofArtifactFormat?: string;
  proofArtifactDigest?: string;
  verificationKeyId?: string;
}

export function buildAnchorSubject(receiptHash: string, attestation?: ZKPAttestation): AnchorSubject {
  const material = {
    version: ANCHOR_SUBJECT_VERSION,
    receiptHash,
    scheme: attestation?.scheme ?? null,
    status: attestation?.status ?? null,
    backend: attestation?.backend ?? null,
    circuitId: attestation?.circuitId ?? null,
    documentDigest: attestation?.publicInputs?.documentDigest ?? null,
    documentCommitment: attestation?.publicInputs?.documentCommitment ?? null,
    schemaVersion: attestation?.publicInputs?.schemaVersion ?? null,
    documentWitnessMode: attestation?.publicInputs?.documentWitnessMode ?? null,
    proofArtifactFormat: attestation?.proofArtifact?.format ?? null,
    proofArtifactDigest: attestation?.proofArtifact?.digest ?? null,
    verificationKeyId: attestation?.verificationKeyId ?? null
  };

  return {
    version: ANCHOR_SUBJECT_VERSION,
    hash: keccak256(toUtf8Bytes(canonicalizeJson(material))),
    receiptHash,
    ...(attestation?.scheme ? { scheme: attestation.scheme } : {}),
    ...(attestation?.status ? { status: attestation.status } : {}),
    ...(attestation?.backend ? { backend: attestation.backend } : {}),
    ...(attestation?.circuitId ? { circuitId: attestation.circuitId } : {}),
    ...(attestation?.publicInputs?.documentDigest ? { documentDigest: attestation.publicInputs.documentDigest } : {}),
    ...(attestation?.publicInputs?.documentCommitment ? { documentCommitment: attestation.publicInputs.documentCommitment } : {}),
    ...(attestation?.publicInputs?.schemaVersion ? { schemaVersion: attestation.publicInputs.schemaVersion } : {}),
    ...(attestation?.publicInputs?.documentWitnessMode ? { documentWitnessMode: attestation.publicInputs.documentWitnessMode } : {}),
    ...(attestation?.proofArtifact?.format ? { proofArtifactFormat: attestation.proofArtifact.format } : {}),
    ...(attestation?.proofArtifact?.digest ? { proofArtifactDigest: attestation.proofArtifact.digest } : {}),
    ...(attestation?.verificationKeyId ? { verificationKeyId: attestation.verificationKeyId } : {})
  };
}
