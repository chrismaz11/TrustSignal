import { describe, it, expect, vi } from 'vitest';
import {
  anchorReceiptOnSolana,
  findSolanaAnchor,
  getCluster,
  getRpcUrl,
  loadPayerKeypair
} from '../../solanaAnchor.js';
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  clusterApiUrl
} from '@solana/web3.js';

vi.mock('@solana/web3.js');

describe('solanaAnchor', () => {
  describe('getCluster', () => {
    it('should return devnet by default', () => {
      delete process.env.SOLANA_CLUSTER;
      expect(getCluster()).toBe('devnet');
    });

    it('should return custom cluster from env', () => {
      process.env.SOLANA_CLUSTER = 'mainnet-beta';
      expect(getCluster()).toBe('mainnet-beta');
    });
  });

  describe('getRpcUrl', () => {
    it('should use custom RPC URL if provided', () => {
      process.env.SOLANA_RPC_URL = 'https://custom-rpc.example.com';
      expect(getRpcUrl()).toBe('https://custom-rpc.example.com');
    });

    it('should use clusterApiUrl for known clusters', () => {
      process.env.SOLANA_CLUSTER = 'devnet';
      delete process.env.SOLANA_RPC_URL;
      vi.mocked(clusterApiUrl).mockReturnValue('https://api.devnet.solana.com');
      expect(getRpcUrl()).toBe('https://api.devnet.solana.com');
    });

    it('should default to devnet clusterApiUrl', () => {
      delete process.env.SOLANA_CLUSTER;
      delete process.env.SOLANA_RPC_URL;
      vi.mocked(clusterApiUrl).mockReturnValue('https://api.devnet.solana.com');
      expect(getRpcUrl()).toBe('https://api.devnet.solana.com');
    });
  });

  describe('loadPayerKeypair', () => {
    it('should throw if SOLANA_PAYER_SECRET_KEY is missing', () => {
      delete process.env.SOLANA_PAYER_SECRET_KEY;
      expect(() => loadPayerKeypair()).toThrow('SOLANA_PAYER_SECRET_KEY is required for Solana anchoring');
    });

    it('should throw if secret key is not JSON array format', () => {
      process.env.SOLANA_PAYER_SECRET_KEY = 'not-a-json-array';
      expect(() => loadPayerKeypair()).toThrow('SOLANA_PAYER_SECRET_KEY must be a JSON array');
    });

    it('should load keypair from valid JSON array', () => {
      const mockKeypair = { publicKey: new PublicKey('mock-key') } as unknown as Keypair;
      process.env.SOLANA_PAYER_SECRET_KEY = '[1,2,3,4,5]';
      vi.mocked(Keypair.fromSecretKey).mockReturnValue(mockKeypair);
      const result = loadPayerKeypair();
      expect(result).toEqual(mockKeypair);
    });
  });

  describe('anchorReceiptOnSolana', () => {
    it('should anchor receipt and return result', async () => {
      const mockConnection = {} as Connection;
      const mockKeypair = { publicKey: new PublicKey('mock-key') } as unknown as Keypair;
      const mockSignature = 'mock-signature';

      vi.mocked(Connection).mockReturnValue(mockConnection);
      vi.mocked(loadPayerKeypair).mockReturnValue(mockKeypair);
      vi.mocked(sendAndConfirmTransaction).mockResolvedValue(mockSignature);
      vi.mocked(mockConnection.getSlot).mockResolvedValue(12345);
      vi.mocked(mockConnection.getBlockTime).mockResolvedValue(1234567890);

      const result = await anchorReceiptOnSolana('receipt-hash', 'subject-digest', 'v1');

      expect(result).toEqual({
        status: 'ANCHORED',
        txHash: mockSignature,
        chainId: 'solana-devnet',
        subjectDigest: 'subject-digest',
        subjectVersion: 'v1',
        anchoredAt: '1970-01-15T18:56:07.890Z'
      });
    });

    it('should handle missing block time', async () => {
      const mockConnection = {} as Connection;
      const mockKeypair = { publicKey: new PublicKey('mock-key') } as unknown as Keypair;
      const mockSignature = 'mock-signature';

      vi.mocked(Connection).mockReturnValue(mockConnection);
      vi.mocked(loadPayerKeypair).mockReturnValue(mockKeypair);
      vi.mocked(sendAndConfirmTransaction).mockResolvedValue(mockSignature);
      vi.mocked(mockConnection.getSlot).mockResolvedValue(12345);
      vi.mocked(mockConnection.getBlockTime).mockResolvedValue(null);

      const result = await anchorReceiptOnSolana('receipt-hash', 'subject-digest', 'v1');

      expect(result.anchoredAt).toBeDefined();
    });
  });

  describe('findSolanaAnchor', () => {
    it('should return null if no anchor found', async () => {
      const mockConnection = {
        getSignaturesForAddress: vi.fn().mockResolvedValue([])
      } as unknown as Connection;

      vi.mocked(Connection).mockReturnValue(mockConnection);
      vi.mocked(loadPayerKeypair).mockReturnValue({ publicKey: new PublicKey('mock-key') } as Keypair);

      const result = await findSolanaAnchor('receipt-hash', 'subject-digest', 'v1');
      expect(result).toBeNull();
    });

    it('should return anchor result if found', async () => {
      const mockPublicKey = new PublicKey('mock-key');
      const mockConnection = {
        getSignaturesForAddress: vi.fn().mockResolvedValue([
          { signature: 'tx-sig', blockTime: 1234567890 }
        ]),
        getTransaction: vi.fn().mockResolvedValue({
          transaction: {
            message: {
              compiledInstructions: [
                {
                  data: Buffer.from('trustsignal:anchor:v1:receipt-hash:subject-digest', 'utf8'),
                  programIdIndex: 0
                }
              ]
            }
          }
        })
      } as unknown as Connection;

      vi.mocked(Connection).mockReturnValue(mockConnection);
      vi.mocked(loadPayerKeypair).mockReturnValue({ publicKey: mockPublicKey } as Keypair);

      const result = await findSolanaAnchor('receipt-hash', 'subject-digest', 'v1');

      expect(result).toEqual({
        status: 'ALREADY_ANCHORED',
        txHash: 'tx-sig',
        chainId: 'solana-devnet',
        subjectDigest: 'subject-digest',
        subjectVersion: 'v1',
        anchoredAt: '1970-01-15T18:56:07.890Z'
      });
    });

    it('should handle non-UTF8 memo data gracefully', async () => {
      const mockPublicKey = new PublicKey('mock-key');
      const mockConnection = {
        getSignaturesForAddress: vi.fn().mockResolvedValue([
          { signature: 'tx-sig', blockTime: 1234567890 }
        ]),
        getTransaction: vi.fn().mockResolvedValue({
          transaction: {
            message: {
              compiledInstructions: [
                {
                  data: Buffer.from([0x00, 0x01, 0x02]), // Non-UTF8 data
                  programIdIndex: 0
                }
              ]
            }
          }
        })
      } as unknown as Connection;

      vi.mocked(Connection).mockReturnValue(mockConnection);
      vi.mocked(loadPayerKeypair).mockReturnValue({ publicKey: mockPublicKey } as Keypair);

      const result = await findSolanaAnchor('receipt-hash', 'subject-digest', 'v1');
      expect(result).toBeNull();
    });
  });
});
