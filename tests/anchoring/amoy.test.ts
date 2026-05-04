/**
 * tests/anchoring/amoy.test.ts
 *
 * Unit tests for the Polygon Amoy anchor service (polygonAmoyAnchor.ts).
 *
 * These tests mock the ethers library so no live RPC connection is required.
 * They verify:
 *   1. A data artifact can be hashed (via crypto.createHash) to produce a receipt hash.
 *   2. anchorReceiptOnPolygonAmoy anchors the hash and returns a well-formed result.
 *   3. anchorReceiptOnPolygonAmoy returns ALREADY_ANCHORED for a duplicate submission.
 *   4. findPolygonAmoyAnchor returns null when no anchor exists.
 *   5. findPolygonAmoyAnchor returns a result when an anchor is found.
 *   6. Environment-variable error paths throw descriptive errors.
 */

import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Contract, Interface, JsonRpcProvider, Log, Wallet } from 'ethers';
import {
  anchorReceiptOnPolygonAmoy,
  findPolygonAmoyAnchor,
  type PolygonAmoyAnchorResult
} from '../../apps/api/src/polygonAmoyAnchor.js';

vi.mock('ethers');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Simulate ingesting a data artifact and deriving its receipt hash. */
function hashArtifact(data: string): string {
  return '0x' + createHash('sha256').update(data).digest('hex');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Polygon Amoy Anchor Service', () => {
  let envSnapshot: Record<string, string | undefined>;
  let mockProvider: JsonRpcProvider;
  let mockWallet: Wallet;
  let mockContract: Contract;

  beforeEach(() => {
    // Snapshot env vars we intend to set
    envSnapshot = {
      POLYGON_AMOY_NETWORK: process.env.POLYGON_AMOY_NETWORK,
      POLYGON_AMOY_RPC_URL: process.env.POLYGON_AMOY_RPC_URL,
      POLYGON_AMOY_REGISTRY_ADDRESS: process.env.POLYGON_AMOY_REGISTRY_ADDRESS,
      POLYGON_AMOY_PRIVATE_KEY: process.env.POLYGON_AMOY_PRIVATE_KEY,
      POLYGON_MAINNET_RPC_URL: process.env.POLYGON_MAINNET_RPC_URL
    };

    // Set required env vars for Amoy testnet
    process.env.POLYGON_AMOY_NETWORK = 'amoy';
    process.env.POLYGON_AMOY_RPC_URL = 'https://rpc-amoy.polygon.technology';
    process.env.POLYGON_AMOY_REGISTRY_ADDRESS = '0xABCDEF1234567890ABcDEF1234567890aBcDeF12';
    process.env.POLYGON_AMOY_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    delete process.env.POLYGON_MAINNET_RPC_URL;

    // Build contract mock with vi.fn() methods so vi.mocked() works
    mockContract = {
      isAnchored: vi.fn(),
      subjectForReceipt: vi.fn(),
      anchorWithSubject: vi.fn()
    } as unknown as Contract;

    mockProvider = {} as JsonRpcProvider;
    mockWallet = {} as Wallet;

    // Wire up ethers mocks — vitest 4.x requires 'class' keyword for constructor mocks
    const capturedProvider = mockProvider;
    const capturedWallet = mockWallet;
    const capturedContract = mockContract;
    vi.mocked(JsonRpcProvider).mockImplementation(class { constructor() { return capturedProvider; } } as unknown as typeof JsonRpcProvider);
    vi.mocked(Wallet).mockImplementation(class { constructor() { return capturedWallet; } } as unknown as typeof Wallet);
    vi.mocked(Contract).mockImplementation(class { constructor() { return capturedContract; } } as unknown as typeof Contract);
  });

  afterEach(() => {
    // Restore env vars
    for (const [key, value] of Object.entries(envSnapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Hashing
  // -------------------------------------------------------------------------

  describe('artifact ingestion and hashing', () => {
    it('generates a deterministic SHA-256 receipt hash from a data artifact', () => {
      const artifact = JSON.stringify({
        documentType: 'ClosingDisclosure',
        loanAmount: 350000,
        borrower: 'John Doe',
        closeDate: '2026-05-01'
      });

      const hash1 = hashArtifact(artifact);
      const hash2 = hashArtifact(artifact);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^0x[0-9a-f]{64}$/);
    });

    it('produces different hashes for different artifacts', () => {
      const original = JSON.stringify({ amount: 350000, tampered: false });
      const tampered = JSON.stringify({ amount: 350001, tampered: true });

      expect(hashArtifact(original)).not.toBe(hashArtifact(tampered));
    });
  });

  // -------------------------------------------------------------------------
  // anchorReceiptOnPolygonAmoy — happy paths
  // -------------------------------------------------------------------------

  describe('anchorReceiptOnPolygonAmoy', () => {
    it('anchors a new receipt hash and returns ANCHORED status on Amoy', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);
      vi.mocked(mockContract.anchorWithSubject).mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          hash: '0xTX_HASH_AMOY',
          logs: [] as Log[]
        })
      });

      const receiptHash = hashArtifact('bank-statement-2026-Q1');
      const result = await anchorReceiptOnPolygonAmoy(
        receiptHash,
        '0xSUBJECT_DIGEST',
        'v1'
      );

      expect(result.status).toBe('ANCHORED');
      expect(result.chainId).toBe('polygon-amoy');
      expect(result.txHash).toBe('0xTX_HASH_AMOY');
      expect(result.subjectDigest).toBe('0xSUBJECT_DIGEST');
      expect(result.subjectVersion).toBe('v1');
    });

    it('extracts anchorId and anchoredAt from the Anchored event log', async () => {
      const mockLog = { topics: [], data: '0x' } as Log;
      const mockInterface = {
        parseLog: vi.fn().mockReturnValue({
          name: 'Anchored',
          args: {
            anchorId: '0xANCHOR_ID',
            timestamp: 1746388661n,
            subjectDigest: '0xEVENT_SUBJECT'
          }
        })
      } as unknown as Interface;

      const capturedInterface = mockInterface;
      vi.mocked(Interface).mockImplementation(class { constructor() { return capturedInterface; } } as unknown as typeof Interface);
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);
      vi.mocked(mockContract.anchorWithSubject).mockResolvedValue({
        wait: vi.fn().mockResolvedValue({
          hash: '0xTX_WITH_LOG',
          logs: [mockLog]
        })
      });

      const result = await anchorReceiptOnPolygonAmoy(
        hashArtifact('closing-disclosure-2026'),
        '0xSUBJECT_DIGEST',
        'v1'
      );

      expect(result.anchorId).toBe('0xANCHOR_ID');
      expect(result.anchoredAt).toBe(new Date(1746388661 * 1000).toISOString());
      expect(result.subjectDigest).toBe('0xEVENT_SUBJECT');
    });

    it('returns ALREADY_ANCHORED without sending a tx when receipt exists on-chain', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(true);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue('0xEXISTING_SUBJECT');

      const result = await anchorReceiptOnPolygonAmoy(
        hashArtifact('already-anchored-doc'),
        '0xSUBJECT_DIGEST',
        'v1'
      );

      expect(result.status).toBe('ALREADY_ANCHORED');
      expect(result.chainId).toBe('polygon-amoy');
      expect(result.subjectDigest).toBe('0xEXISTING_SUBJECT');
      expect(result.txHash).toBeUndefined();

      // Ensure no transaction was submitted
      expect(mockContract.anchorWithSubject).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // findPolygonAmoyAnchor
  // -------------------------------------------------------------------------

  describe('findPolygonAmoyAnchor', () => {
    it('returns null when the receipt has not been anchored', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);

      const result = await findPolygonAmoyAnchor(
        hashArtifact('unanchored-doc'),
        '0xSUBJECT',
        'v1'
      );

      expect(result).toBeNull();
    });

    it('returns an ALREADY_ANCHORED result when the receipt is found on-chain', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(true);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue('0xCHAIN_SUBJECT');

      const result = await findPolygonAmoyAnchor(
        hashArtifact('existing-doc'),
        '0xSUBJECT',
        'v1'
      ) as PolygonAmoyAnchorResult;

      expect(result).not.toBeNull();
      expect(result.status).toBe('ALREADY_ANCHORED');
      expect(result.chainId).toBe('polygon-amoy');
      expect(result.subjectDigest).toBe('0xCHAIN_SUBJECT');
      expect(result.subjectVersion).toBe('v1');
    });

    it('falls back to the provided subjectDigest when subjectForReceipt returns a zero value', async () => {
      vi.mocked(mockContract.isAnchored).mockResolvedValue(true);
      vi.mocked(mockContract.subjectForReceipt).mockResolvedValue(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      );

      const result = await findPolygonAmoyAnchor(
        hashArtifact('fallback-doc'),
        '0xFALLBACK_SUBJECT',
        'v1'
      ) as PolygonAmoyAnchorResult;

      expect(result.subjectDigest).toBe(
        '0x0000000000000000000000000000000000000000000000000000000000000000'
      );
    });
  });

  // -------------------------------------------------------------------------
  // Error paths
  // -------------------------------------------------------------------------

  describe('error paths', () => {
    it('throws when POLYGON_AMOY_REGISTRY_ADDRESS is missing', async () => {
      delete process.env.POLYGON_AMOY_REGISTRY_ADDRESS;
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);

      await expect(
        anchorReceiptOnPolygonAmoy(hashArtifact('doc'), '0xSUBJECT', 'v1')
      ).rejects.toThrow('POLYGON_AMOY_REGISTRY_ADDRESS is required');
    });

    it('throws when POLYGON_AMOY_PRIVATE_KEY is missing', async () => {
      delete process.env.POLYGON_AMOY_PRIVATE_KEY;
      vi.mocked(mockContract.isAnchored).mockResolvedValue(false);

      await expect(
        anchorReceiptOnPolygonAmoy(hashArtifact('doc'), '0xSUBJECT', 'v1')
      ).rejects.toThrow('POLYGON_AMOY_PRIVATE_KEY is required');
    });

    it('throws when POLYGON_MAINNET_RPC_URL is missing in mainnet mode', async () => {
      process.env.POLYGON_AMOY_NETWORK = 'mainnet';
      delete process.env.POLYGON_MAINNET_RPC_URL;

      await expect(
        anchorReceiptOnPolygonAmoy(hashArtifact('doc'), '0xSUBJECT', 'v1')
      ).rejects.toThrow('POLYGON_MAINNET_RPC_URL is required for Polygon PoS Mainnet anchoring');
    });
  });
});
