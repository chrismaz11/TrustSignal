import { describe, it, expect, vi } from 'vitest';
import { renderReceiptPdf } from '../../receiptPdf.js';
import { Receipt } from '../../../../packages/core/dist/index.js';

describe('renderReceiptPdf', () => {
  const mockReceipt: Receipt = {
    receiptId: 'test-receipt-id',
    createdAt: '2024-01-01T00:00:00Z',
    policyProfile: 'test-profile',
    decision: 'clean',
    riskScore: 0.5,
    inputsCommitment: 'test-inputs-commitment',
    receiptHash: 'test-receipt-hash',
    reasons: ['reason1', 'reason2'],
    checks: [
      { checkId: 'check1', status: 'pass', details: 'detail1' },
      { checkId: 'check2', status: 'fail', details: 'detail2' }
    ]
  };

  it('should render a PDF buffer for a valid receipt', async () => {
    const result = await renderReceiptPdf(mockReceipt);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty reasons array', async () => {
    const receiptWithEmptyReasons = { ...mockReceipt, reasons: [] };
    const result = await renderReceiptPdf(receiptWithEmptyReasons);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle empty checks array', async () => {
    const receiptWithEmptyChecks = { ...mockReceipt, checks: [] };
    const result = await renderReceiptPdf(receiptWithEmptyChecks);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle missing details in checks', async () => {
    const receiptWithMissingDetails = {
      ...mockReceipt,
      checks: [{ checkId: 'check1', status: 'pass' }]
    };
    const result = await renderReceiptPdf(receiptWithMissingDetails);
    expect(result).toBeInstanceOf(Buffer);
  });

  it('should handle long receipt content', async () => {
    const receiptWithLongContent = {
      ...mockReceipt,
      reasons: Array(100).fill('long reason'),
      checks: Array(100).fill({ checkId: 'check', status: 'pass', details: 'long detail' })
    };
    const result = await renderReceiptPdf(receiptWithLongContent);
    expect(result).toBeInstanceOf(Buffer);
  });
});
