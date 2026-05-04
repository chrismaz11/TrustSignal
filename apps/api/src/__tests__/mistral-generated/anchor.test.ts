import { describe, it, expect, vi } from 'vitest';
import {
  anchorReceipt,
  anchorReceiptOnChain,
  buildAnchorSubject,
  parseAnchoredAtTimestamp
} from '../../anchor.js';
import { Contract, Interface, JsonRpcProvider, Log, Wallet } from 'ethers';
import { anchorReceiptOnSolana, findSolanaAnchor } from '../../solanaAnchor.js';

vi.mock('ethers');
vi.mock('../../solanaAnchor.js');

describe('anchor', () => {
  describe('buildAnchorSubject', () => {
    it('should build anchor subject without attestation', () => {
      const result = buildAnchorSubject('receipt-hash');
      expect(result.version).toBe('v1');
      expect(result.digest).toBeDefined();
    });

    it('should build anchor subject with attestation', () => {
      const attestation = { proof: 'proof1', publicSignals: ['signal1'] };
      const result = buildAnchorSubject('receipt-hash', attestation);
      expect(result.version).toBe('v1');
      expect(result.digest).toBeDefined();
    });
  });

  describe('parseAnchoredAtTimestamp', () => {
    it('should parse bigint timestamp', () => {
      const result = parseAnchoredAtTimestamp(1234567890n);
      expect(result).toBe('1970-01-15T18:56:07.890Z');
    });

    it('should parse number timestamp', () => {
      const result = parseAnchoredAtTimestamp(1234567890);
      expect(result).toBe('1970-01-15T18:56:07.890Z');
    });

    it('should parse string timestamp', () => {
      const result = parseAnchoredAtTimestamp('1234567890');
      expect(result).toBe('1970-01-15T18:56:07.890Z');
    });

    it('should return undefined for invalid input', () => {
      expect(parseAnchoredAtTimestamp(null)).toBeUndefined();
      expect(parseAnchoredAtTimestamp('invalid')).toBeUndefined();
      expect(parseAnchoredAtTimestamp({})).toBeUndefined();
    });
  });

  describe('anchorReceipt', () => {
    const mockProvider = {} as JsonRpcProvider;
    const mockWallet = {} as Wallet;
    const mockContract = {} as Contract;

    beforeEach(() => {
      process.env.ANCHOR_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890';
      process.env.PRIVATE_KEY = '0xprivatekey';

      vi.mocked(JsonRpcProvider).mockReturnValue(mockProvider);
      vi.mocked(Wallet).mockReturnValue(mockWallet);
      vi.mocked(Contract).mockReturnValue(mockContract);

      vi.mocked(mockProvider.getNetwork).mockResolvedValue({ chainId: 11155111n });
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000');
      vi.mocked(mockContract.anchorWithSubject).mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          hash: 'tx-hash',
          logs: []
        })
      });
    });

    it('should throw if ANCHOR_REGISTRY_ADDRESS is missing', async () => {
      delete process.env.ANCHOR_REGISTRY_ADDRESS;
      await expect(anchorReceipt('receipt-hash')).rejects.toThrow('ANCHOR_REGISTRY_ADDRESS is required');
    });

    it('should throw if private key is missing', async () => {
      delete process.env.PRIVATE_KEY;
      delete process.env.LOCAL_PRIVATE_KEY;
      await expect(anchorReceipt('receipt-hash')).rejects.toThrow('Missing PRIVATE_KEY or LOCAL_PRIVATE_KEY');
    });

    it('should anchor receipt successfully', async () => {
      const result = await anchorReceipt('receipt-hash');
      expect(result.status).toBe('ANCHORED');
      expect(result.chain).toBe('evm');
      expect(result.chainId).toBe('11155111');
    });

    it('should handle already anchored receipt', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(true);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue('subject-digest');

      const result = await anchorReceipt('receipt-hash');
      expect(result.status).toBe('ALREADY_ANCHORED');
      expect(result.subjectDigest).toBe('subject-digest');
    });

    it('should parse anchor event log', async () => {
      const mockLog = {
        topics: [],
        data: '0x'
      } as Log;

      const mockInterface = {
        parseLog: vi.fn().mockReturnValue({
          name: 'Anchored',
          args: {
            anchorId: 'anchor-id',
            timestamp: 1234567890n,
            subjectDigest: 'subject-digest'
          }
        })
      } as unknown as Interface;

      vi.mocked(Interface).mockReturnValue(mockInterface);
      vi.mocked(mockContract.anchorWithSubject).mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          hash: 'tx-hash',
          logs: [mockLog]
        })
      });

      const result = await anchorReceipt('receipt-hash');
      expect(result.anchorId).toBe('anchor-id');
      expect(result.anchoredAt).toBe('1970-01-15T18:56:07.890Z');
      expect(result.subjectDigest).toBe('subject-digest');
    });
  });

  describe('anchorReceiptOnChain', () => {
    it('should anchor on EVM by default', async () => {
      const mockProvider = {} as JsonRpcProvider;
      const mockWallet = {} as Wallet;
      const mockContract = {} as Contract;

      process.env.ANCHOR_REGISTRY_ADDRESS = '0x1234567890123456789012345678901234567890';
      process.env.PRIVATE_KEY = '0xprivatekey';

      vi.mocked(JsonRpcProvider).mockReturnValue(mockProvider);
      vi.mocked(Wallet).mockReturnValue(mockWallet);
      vi.mocked(Contract).mockReturnValue(mockContract);

      vi.mocked(mockProvider.getNetwork).mockResolvedValue({ chainId: 11155111n });
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue('0x0000000000000000000000000000000000000000000000000000000000000000');
      vi.mocked(mockContract.anchorWithSubject).mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          hash: 'tx-hash',
          logs: []
        })
      });

      const result = await anchorReceiptOnChain('receipt-hash', 'evm');
      expect(result.chain).toBe('evm');
    });

    it('should anchor on Solana when specified', async () => {
      vi.mocked(findSolanaAnchor).mockResolvedValue(null);
      vi.mocked(anchorReceiptOnSolana).mockResolvedValue({
        status: 'ANCHORED',
        txHash: 'solana-tx',
        chainId: 'solana-devnet',
        subjectDigest: 'subject-digest',
        subjectVersion: 'v1',
        anchoredAt: '2024-01-01T00:00:00Z'
      });

      const result = await anchorReceiptOnChain('receipt-hash', 'solana');
      expect(result.chain).toBe('solana');
      expect(result.txHash).toBe('solana-tx');
    });

    it('should return existing Solana anchor if found', async () => {
      vi.mocked(findSolanaAnchor).mockResolvedValue({
        status: 'ALREADY_ANCHORED',
        txHash: 'existing-tx',
        chainId: 'solana-devnet',
        subjectDigest: 'subject-digest',
        subjectVersion: 'v1',
        anchoredAt: '2024-01-01T00:00:00Z'
      });

      const result = await anchorReceiptOnChain('receipt-hash', 'solana');
      expect(result.status).toBe('ALREADY_ANCHORED');
      expect(result.txHash).toBe('existing-tx');
    });
  });
});
