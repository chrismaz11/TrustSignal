import { describe, it, expect } from 'vitest';
import { toV2VerifyResponse, band } from '../../../lib/v2ReceiptMapper.js';

describe('v2ReceiptMapper', () => {
  describe('toV2VerifyResponse', () => {
    it('should map basic response', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1'
      });

      expect(result.receiptVersion).toBe('2.0');
      expect(result.decision).toBe('ALLOW');
      expect(result.receiptId).toBe('receipt1');
      expect(result.receiptHash).toBe('hash1');
      expect(result.anchor.status).toBe('PENDING');
      expect(result.anchor.backend).toBe('EVM_LOCAL');
      expect(result.revocation.status).toBe('ACTIVE');
    });

    it('should include receipt signature when provided', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        receiptSignature: {
          signature: 'sig1',
          alg: 'EdDSA',
          kid: 'key1'
        }
      });

      expect(result.receiptSignature).toBeDefined();
      expect(result.receiptSignature?.signature).toBe('sig1');
    });

    it('should include proofVerified when provided', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        proofVerified: true
      });

      expect(result.proofVerified).toBe(true);
    });

    it('should map anchor fields when provided', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        anchor: {
          status: 'ANCHORED',
          txHash: 'tx1',
          chainId: 'chain1',
          anchorId: 'anchor1',
          anchoredAt: '2024-01-01T00:00:00Z',
          subjectDigest: 'digest1',
          subjectVersion: 'v1'
        }
      });

      expect(result.anchor.status).toBe('ANCHORED');
      expect(result.anchor.txHash).toBe('tx1');
      expect(result.anchor.chainId).toBe('chain1');
      expect(result.anchor.anchorId).toBe('anchor1');
      expect(result.anchor.anchoredAt).toBe('2024-01-01T00:00:00Z');
      expect(result.anchor.subjectDigest).toBe('digest1');
      expect(result.anchor.subjectVersion).toBe('v1');
    });

    it('should map fraud risk with custom score and band', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        fraudRisk: {
          score: 0.8,
          band: 'HIGH',
          signals: [{ type: 'signal1' }]
        }
      });

      expect(result.fraudRisk.score).toBe(0.8);
      expect(result.fraudRisk.band).toBe('HIGH');
      expect(result.fraudRisk.signals).toEqual([{ type: 'signal1' }]);
    });

    it('should clamp fraud risk score to 0-1 range', () => {
      const result1 = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        fraudRisk: { score: 1.5 }
      });
      expect(result1.fraudRisk.score).toBe(1);

      const result2 = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        fraudRisk: { score: -0.5 }
      });
      expect(result2.fraudRisk.score).toBe(0);

      const result3 = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        fraudRisk: { score: NaN }
      });
      expect(result3.fraudRisk.score).toBe(0);
    });

    it('should include deprecated fields when requested', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        riskScore: 0.5,
        revoked: true,
        includeDeprecated: true
      });

      expect(result.deprecated).toBeDefined();
      expect(result.deprecated?.riskScore).toBe(0.5);
      expect(result.deprecated?.revoked).toBe(true);
    });

    it('should not include deprecated fields by default', () => {
      const result = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        riskScore: 0.5,
        revoked: true
      });

      expect(result.deprecated).toBeUndefined();
    });

    it('should map revoked status correctly', () => {
      const result1 = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        revoked: false
      });
      expect(result1.revocation.status).toBe('ACTIVE');

      const result2 = toV2VerifyResponse({
        decision: 'ALLOW',
        receiptId: 'receipt1',
        receiptHash: 'hash1',
        revoked: true
      });
      expect(result2.revocation.status).toBe('REVOKED');
    });
  });

  describe('band function', () => {
    it('should return LOW for scores < 0.33', () => {
      expect(band(0)).toBe('LOW');
      expect(band(0.3)).toBe('LOW');
      expect(band(0.329)).toBe('LOW');
    });

    it('should return MEDIUM for scores 0.33-0.66', () => {
      expect(band(0.33)).toBe('MEDIUM');
      expect(band(0.5)).toBe('MEDIUM');
      expect(band(0.659)).toBe('MEDIUM');
    });

    it('should return HIGH for scores >= 0.66', () => {
      expect(band(0.66)).toBe('HIGH');
      expect(band(0.8)).toBe('HIGH');
      expect(band(1)).toBe('HIGH');
    });
  });
});
