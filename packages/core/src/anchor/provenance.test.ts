import { describe, expect, it } from 'vitest';

import { buildAnchorSubject, ANCHOR_SUBJECT_VERSION } from './provenance.js';

describe('Anchor provenance', () => {
  it('binds the receipt hash to proof provenance metadata', () => {
    const receiptHash = '0xabc123';
    const subject = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-v1',
      status: 'verifiable',
      backend: 'halo2',
      publicInputs: {
        policyHash: '0xpolicy',
        timestamp: '2026-03-07T00:00:00.000Z',
        inputsCommitment: '0xinputs',
        conformance: true,
        declaredDocHash: '0xdeclared',
        documentDigest: '0xdigest',
        documentCommitment: '0xcommitment',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'halo2-ipa-pasta-v1',
        digest: '0xproofdigest'
      },
      verificationKeyId: 'vk-doc-hash-v1',
      verifiedAt: '2026-03-07T00:00:01.000Z'
    });

    expect(subject.version).toBe(ANCHOR_SUBJECT_VERSION);
    expect(subject.receiptHash).toBe(receiptHash);
    expect(subject.proofArtifactDigest).toBe('0xproofdigest');
    expect(subject.verificationKeyId).toBe('vk-doc-hash-v1');
    expect(subject.hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it('changes the subject hash when proof provenance changes', () => {
    const receiptHash = '0xabc123';
    const base = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only',
      backend: 'halo2-dev',
      publicInputs: {
        policyHash: '0xpolicy',
        timestamp: '2026-03-07T00:00:00.000Z',
        inputsCommitment: '0xinputs',
        conformance: true,
        declaredDocHash: '0xdeclared',
        documentDigest: '0xdigest',
        documentCommitment: '0xcommitment-a',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'keccak256',
        digest: '0xproofdigest-a'
      }
    });
    const changed = buildAnchorSubject(receiptHash, {
      proofId: 'proof-1',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only',
      backend: 'halo2-dev',
      publicInputs: {
        policyHash: '0xpolicy',
        timestamp: '2026-03-07T00:00:00.000Z',
        inputsCommitment: '0xinputs',
        conformance: true,
        declaredDocHash: '0xdeclared',
        documentDigest: '0xdigest',
        documentCommitment: '0xcommitment-b',
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'canonical-document-bytes-v1'
      },
      proofArtifact: {
        format: 'keccak256',
        digest: '0xproofdigest-b'
      }
    });

    expect(base.hash).not.toBe(changed.hash);
  });
});
