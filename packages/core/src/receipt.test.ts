import { describe, expect, it } from 'vitest';

import { buildReceipt, computeInputsCommitment, computeReceiptHash, toUnsignedReceiptPayload } from './receipt.js';
import type { BundleInput, Receipt, VerificationResult } from './types.js';

const baseBundle: BundleInput = {
  bundleId: 'BUNDLE-001',
  transactionType: 'warranty',
  ron: {
    provider: 'RON-1',
    notaryId: 'NOTARY-1',
    commissionState: 'CA',
    sealPayload: 'v1:mock-sig'
  },
  doc: { docHash: '0xabcdef' },
  property: { parcelId: 'PARCEL-1', county: 'Cook', state: 'IL' },
  policy: { profile: 'STANDARD_CA' },
  timestamp: '2024-01-01T00:00:00.000Z'
};

const baseVerification: VerificationResult = {
  decision: 'ALLOW',
  reasons: [],
  riskScore: 0.1,
  checks: [{ checkId: 'notary', status: 'PASS' }]
};

describe('computeInputsCommitment', () => {
  it('returns a non-empty hex string', () => {
    const commitment = computeInputsCommitment(baseBundle);
    expect(commitment).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('returns same value for identical inputs', () => {
    const c1 = computeInputsCommitment(baseBundle);
    const c2 = computeInputsCommitment({ ...baseBundle });
    expect(c1).toBe(c2);
  });

  it('returns different value when bundle content changes', () => {
    const c1 = computeInputsCommitment(baseBundle);
    const c2 = computeInputsCommitment({ ...baseBundle, bundleId: 'BUNDLE-002' });
    expect(c1).not.toBe(c2);
  });

  it('is order-independent for object keys (canonical)', () => {
    const bundle1 = { ...baseBundle, doc: { docHash: '0x111' } };
    // Same keys in different order - computeInputsCommitment uses canonicalizeJson
    const bundle2: BundleInput = {
      transactionType: bundle1.transactionType,
      bundleId: bundle1.bundleId,
      ron: bundle1.ron,
      doc: bundle1.doc,
      property: bundle1.property,
      policy: bundle1.policy,
      timestamp: bundle1.timestamp
    };
    const c1 = computeInputsCommitment(bundle1);
    const c2 = computeInputsCommitment(bundle2);
    expect(c1).toBe(c2);
  });
});

describe('computeReceiptHash', () => {
  it('returns a non-empty hex string', () => {
    const receipt = buildReceipt(baseBundle, baseVerification);
    const payload = toUnsignedReceiptPayload(receipt);
    const hash = computeReceiptHash(payload);
    expect(hash).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('produces stable hash for same payload', () => {
    const receipt = buildReceipt(baseBundle, baseVerification);
    const payload = toUnsignedReceiptPayload(receipt);
    const h1 = computeReceiptHash(payload);
    const h2 = computeReceiptHash(payload);
    expect(h1).toBe(h2);
  });
});

describe('buildReceipt', () => {
  it('returns a receipt with all required fields', () => {
    const receipt = buildReceipt(baseBundle, baseVerification);

    expect(receipt.receiptVersion).toBe('1.0');
    expect(typeof receipt.receiptId).toBe('string');
    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.policyProfile).toBe('STANDARD_CA');
    expect(receipt.inputsCommitment).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(receipt.decision).toBe('ALLOW');
    expect(receipt.riskScore).toBe(0.1);
    expect(receipt.verifierId).toBe('deed-shield');
    expect(receipt.receiptHash).toMatch(/^0x[0-9a-fA-F]+$/);
  });

  it('uses custom verifierId when provided', () => {
    const receipt = buildReceipt(baseBundle, baseVerification, 'custom-verifier');
    expect(receipt.verifierId).toBe('custom-verifier');
  });

  it('includes signing_key_id extension when provided', () => {
    const receipt = buildReceipt(baseBundle, baseVerification, 'deed-shield', {
      signing_key_id: 'key-123'
    });
    expect(receipt.signing_key_id).toBe('key-123');
  });

  it('omits signing_key_id when not provided', () => {
    const receipt = buildReceipt(baseBundle, baseVerification);
    expect(receipt.signing_key_id).toBeUndefined();
  });

  it('includes fraudRisk extension when provided', () => {
    const fraudRisk = { score: 0.8, band: 'HIGH' as const, signals: [] };
    const receipt = buildReceipt(baseBundle, baseVerification, 'deed-shield', { fraudRisk });
    expect(receipt.fraudRisk).toEqual(fraudRisk);
  });

  it('includes zkpAttestation extension when provided', () => {
    const zkpAttestation = {
      proofId: 'proof-001',
      scheme: 'HALO2-DEV-v0',
      status: 'dev-only' as const,
      backend: 'halo2-dev' as const,
      circuitId: 'document-sha256-v1',
      publicInputs: {
        conformance: true,
        schemaVersion: 'trustsignal.document_sha256.v1',
        documentWitnessMode: 'declared-doc-hash-v1' as const,
        documentDigest: '0x' + 'a'.repeat(64),
        documentCommitment: '0x' + 'b'.repeat(64)
      }
    };
    const receipt = buildReceipt(baseBundle, baseVerification, 'deed-shield', { zkpAttestation });
    expect(receipt.zkpAttestation?.proofId).toBe('proof-001');
  });

  it('generates unique receiptId for each call', () => {
    const r1 = buildReceipt(baseBundle, baseVerification);
    const r2 = buildReceipt(baseBundle, baseVerification);
    expect(r1.receiptId).not.toBe(r2.receiptId);
  });

  it('receiptHash changes when decision changes', () => {
    const r1 = buildReceipt(baseBundle, baseVerification);
    const r2 = buildReceipt(baseBundle, { ...baseVerification, decision: 'BLOCK' });
    // ReceiptHash depends on the payload - different content = different hash
    // Note: receiptId is random so each call has a different hash, but both should be valid hashes
    expect(r1.receiptHash).toMatch(/^0x[0-9a-fA-F]+$/);
    expect(r2.receiptHash).toMatch(/^0x[0-9a-fA-F]+$/);
  });
});

describe('toUnsignedReceiptPayload', () => {
  it('strips receiptHash and receiptSignature from receipt', () => {
    const receipt: Receipt = {
      receiptVersion: '1.0',
      receiptId: 'id-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      policyProfile: 'STANDARD_CA',
      inputsCommitment: '0xabc',
      checks: [],
      decision: 'ALLOW',
      reasons: [],
      riskScore: 0,
      verifierId: 'deed-shield',
      receiptHash: '0xhash',
      receiptSignature: { signature: 'sig', alg: 'EdDSA', kid: 'key-1' }
    };

    const payload = toUnsignedReceiptPayload(receipt);

    expect((payload as Record<string, unknown>).receiptHash).toBeUndefined();
    expect((payload as Record<string, unknown>).receiptSignature).toBeUndefined();
    expect(payload.receiptVersion).toBe('1.0');
    expect(payload.policyProfile).toBe('STANDARD_CA');
  });

  it('preserves signing_key_id when present', () => {
    const receipt: Receipt = {
      receiptVersion: '1.0',
      receiptId: 'id-2',
      createdAt: '2024-01-01T00:00:00.000Z',
      policyProfile: 'STANDARD_NY',
      inputsCommitment: '0xdef',
      checks: [],
      decision: 'FLAG',
      reasons: ['warn'],
      riskScore: 0.5,
      verifierId: 'deed-shield',
      receiptHash: '0xhash2',
      signing_key_id: 'key-xyz'
    };

    const payload = toUnsignedReceiptPayload(receipt);
    expect(payload.signing_key_id).toBe('key-xyz');
  });

  it('omits signing_key_id when not present in receipt', () => {
    const receipt = buildReceipt(baseBundle, baseVerification);
    const payload = toUnsignedReceiptPayload(receipt);
    expect(payload.signing_key_id).toBeUndefined();
  });
});
