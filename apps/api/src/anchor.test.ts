import { describe, expect, it } from 'vitest';

import { ANCHOR_SUBJECT_VERSION, buildAnchorSubject } from './anchor.js';

describe('anchor provenance subject', () => {
  it('derives a deterministic subject digest from receipt hash and proof provenance', () => {
    const receiptHash = '0x1d89f0f5cf7d5a4c5fcb79ea5a4ea51e7b38714fb4f5f7f186e8c4f602f83ef3';
    const baseline = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only',
      backend: 'halo2-dev',
      publicInputs: {
        policyHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        timestamp: '2026-03-07T12:00:00.000Z',
        inputsCommitment: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        conformance: true,
        declaredDocHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        documentDigest: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        documentCommitment: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'keccak256',
        digest: '0xbeef'
      }
    });
    const changedArtifact = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only',
      backend: 'halo2-dev',
      publicInputs: {
        policyHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        timestamp: '2026-03-07T12:00:00.000Z',
        inputsCommitment: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        conformance: true,
        declaredDocHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        documentDigest: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        documentCommitment: '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'keccak256',
        digest: '0xcafe'
      }
    });

    expect(baseline.version).toBe(ANCHOR_SUBJECT_VERSION);
    expect(baseline.digest).toMatch(/^0x[0-9a-f]{64}$/);
    expect(changedArtifact.digest).not.toBe(baseline.digest);
  });

  it('binds the subject digest to attestation trust semantics, not only artifact bytes', () => {
    const receiptHash = '0x1d89f0f5cf7d5a4c5fcb79ea5a4ea51e7b38714fb4f5f7f186e8c4f602f83ef3';
    const devOnly = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only',
      backend: 'halo2-dev',
      circuitId: 'document-sha256-v1',
      publicInputs: {
        policyHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        timestamp: '2026-03-07T12:00:00.000Z',
        inputsCommitment: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        conformance: true,
        declaredDocHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        documentDigest: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        documentCommitment: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'keccak256',
        digest: '0xbeef'
      }
    });
    const verifiable = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-v1',
      status: 'verifiable',
      backend: 'halo2',
      circuitId: 'document-sha256-v1',
      verificationKeyId: 'vk-1',
      verifiedAt: '2026-03-07T12:00:00.000Z',
      publicInputs: {
        policyHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        timestamp: '2026-03-07T12:00:00.000Z',
        inputsCommitment: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        conformance: true,
        declaredDocHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
        documentDigest: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
        documentCommitment: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'halo2-proof',
        digest: '0xbeef',
        encoding: 'base64',
        proof: 'cHJvb2Y='
      }
    });

    expect(verifiable.version).toBe(ANCHOR_SUBJECT_VERSION);
    expect(verifiable.digest).not.toBe(devOnly.digest);
  });
});
