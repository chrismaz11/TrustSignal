import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ethers', () => {
  const mockWait = vi.fn().mockResolvedValue(undefined);
  const mockSendTransaction = vi.fn().mockResolvedValue({
    hash: '0xmocktxhash',
    wait: mockWait
  });
  const mockGetNetwork = vi.fn().mockResolvedValue({ chainId: 80_001n });
  const MockProvider = vi.fn().mockImplementation(() => ({
    getNetwork: mockGetNetwork
  }));
  const MockWallet = vi.fn().mockImplementation(() => ({
    address: '0xmockaddress',
    sendTransaction: mockSendTransaction
  }));
  return {
    JsonRpcProvider: MockProvider,
    Wallet: MockWallet,
    __mockGetNetwork: mockGetNetwork,
    __mockSendTransaction: mockSendTransaction,
    __mockWait: mockWait
  };
});

import { anchorNullifierToPolygonMumbai } from '../../src/services/polygonMumbaiAnchor.js';
import * as ethers from 'ethers';

describe('anchorNullifierToPolygonMumbai', () => {
  const savedRpc = process.env.POLYGON_MUMBAI_RPC_URL;
  const savedKey = process.env.POLYGON_MUMBAI_PRIVATE_KEY;

  beforeEach(() => {
    process.env.POLYGON_MUMBAI_RPC_URL = 'https://mock-rpc.example.com';
    process.env.POLYGON_MUMBAI_PRIVATE_KEY = '0x' + 'a'.repeat(64);
    vi.clearAllMocks();
    // Re-configure the mock getNetwork to return the correct chain ID by default
    const anyEthers = ethers as unknown as Record<string, unknown>;
    if (typeof anyEthers['__mockGetNetwork'] === 'function') {
      (anyEthers['__mockGetNetwork'] as ReturnType<typeof vi.fn>).mockResolvedValue({ chainId: 80_001n });
    }
    if (typeof anyEthers['__mockSendTransaction'] === 'function') {
      (anyEthers['__mockSendTransaction'] as ReturnType<typeof vi.fn>).mockResolvedValue({
        hash: '0xmocktxhash',
        wait: (anyEthers['__mockWait'] as ReturnType<typeof vi.fn>)
      });
    }
  });

  afterEach(() => {
    if (savedRpc === undefined) {
      delete process.env.POLYGON_MUMBAI_RPC_URL;
    } else {
      process.env.POLYGON_MUMBAI_RPC_URL = savedRpc;
    }
    if (savedKey === undefined) {
      delete process.env.POLYGON_MUMBAI_PRIVATE_KEY;
    } else {
      process.env.POLYGON_MUMBAI_PRIVATE_KEY = savedKey;
    }
  });

  it('throws when POLYGON_MUMBAI_RPC_URL is not set', async () => {
    delete process.env.POLYGON_MUMBAI_RPC_URL;

    await expect(anchorNullifierToPolygonMumbai('bundle-001')).rejects.toThrow(
      'POLYGON_MUMBAI_RPC_URL and POLYGON_MUMBAI_PRIVATE_KEY are required'
    );
  });

  it('throws when POLYGON_MUMBAI_PRIVATE_KEY is not set', async () => {
    delete process.env.POLYGON_MUMBAI_PRIVATE_KEY;

    await expect(anchorNullifierToPolygonMumbai('bundle-001')).rejects.toThrow(
      'POLYGON_MUMBAI_RPC_URL and POLYGON_MUMBAI_PRIVATE_KEY are required'
    );
  });

  it('throws when both env vars are missing', async () => {
    delete process.env.POLYGON_MUMBAI_RPC_URL;
    delete process.env.POLYGON_MUMBAI_PRIVATE_KEY;

    await expect(anchorNullifierToPolygonMumbai('bundle-001')).rejects.toThrow(
      'POLYGON_MUMBAI_RPC_URL and POLYGON_MUMBAI_PRIVATE_KEY are required'
    );
  });

  it('throws on chainId mismatch', async () => {
    const anyEthers = ethers as unknown as Record<string, unknown>;
    if (typeof anyEthers['__mockGetNetwork'] === 'function') {
      (anyEthers['__mockGetNetwork'] as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        chainId: 1n
      });
    }

    await expect(anchorNullifierToPolygonMumbai('bundle-001')).rejects.toThrow(
      'Mumbai chainId mismatch'
    );
  });

  it('returns tx_hash, timestamp, and nullifier_hash on success', async () => {
    const result = await anchorNullifierToPolygonMumbai('test-bundle-hash');

    expect(result.tx_hash).toBe('0xmocktxhash');
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(result.nullifier_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a deterministic nullifier_hash for the same bundle hash', async () => {
    const anyEthers = ethers as unknown as Record<string, unknown>;
    if (typeof anyEthers['__mockSendTransaction'] === 'function') {
      (anyEthers['__mockSendTransaction'] as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ hash: '0xtx1', wait: vi.fn() })
        .mockResolvedValueOnce({ hash: '0xtx2', wait: vi.fn() });
    }

    const result1 = await anchorNullifierToPolygonMumbai('same-bundle');
    const result2 = await anchorNullifierToPolygonMumbai('same-bundle');

    expect(result1.nullifier_hash).toBe(result2.nullifier_hash);
  });

  it('produces different nullifier_hash for different bundle hashes', async () => {
    const anyEthers = ethers as unknown as Record<string, unknown>;
    if (typeof anyEthers['__mockSendTransaction'] === 'function') {
      (anyEthers['__mockSendTransaction'] as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ hash: '0xtx1', wait: vi.fn() })
        .mockResolvedValueOnce({ hash: '0xtx2', wait: vi.fn() });
    }

    const result1 = await anchorNullifierToPolygonMumbai('bundle-alpha');
    const result2 = await anchorNullifierToPolygonMumbai('bundle-beta');

    expect(result1.nullifier_hash).not.toBe(result2.nullifier_hash);
  });
});
