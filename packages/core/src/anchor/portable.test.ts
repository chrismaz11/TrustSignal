import { describe, expect, it, vi } from 'vitest';

import type { AnchorProof, AnchorProvider } from './portable.js';
import { PortableAnchorManager } from './portable.js';

function makeMockProvider(chainId: string): AnchorProvider & {
  anchor: ReturnType<typeof vi.fn>;
  verifyAnchor: ReturnType<typeof vi.fn>;
} {
  return {
    chainId,
    anchor: vi.fn().mockResolvedValue({ chainId, txHash: `0xtx-${chainId}`, blockNumber: 1 }),
    verifyAnchor: vi.fn().mockResolvedValue(true)
  };
}

describe('PortableAnchorManager', () => {
  it('anchors receipt using the active provider', async () => {
    const provider = makeMockProvider('polygon-mumbai');
    const manager = new PortableAnchorManager(provider);

    const proof = await manager.anchorReceipt('0xreceipthash');

    expect(provider.anchor).toHaveBeenCalledWith('0xreceipthash');
    expect(proof.txHash).toBe('0xtx-polygon-mumbai');
  });

  it('verifies proof using active provider when chainId matches', async () => {
    const provider = makeMockProvider('polygon-mumbai');
    const manager = new PortableAnchorManager(provider);

    const proof: AnchorProof = { chainId: 'polygon-mumbai', txHash: '0xtx' };
    const result = await manager.verifyHistoricalProof(proof);

    expect(result).toBe(true);
    expect(provider.verifyAnchor).toHaveBeenCalledWith(proof);
  });

  it('verifies historical proof using archived provider after chain switch', async () => {
    const oldProvider = makeMockProvider('ethereum');
    const newProvider = makeMockProvider('polygon-mumbai');
    const manager = new PortableAnchorManager(oldProvider);

    await manager.switchAnchorChain(newProvider);

    const historicalProof: AnchorProof = { chainId: 'ethereum', txHash: '0xold-tx' };
    const result = await manager.verifyHistoricalProof(historicalProof);

    expect(result).toBe(true);
    expect(oldProvider.verifyAnchor).toHaveBeenCalledWith(historicalProof);
  });

  it('archives old provider when switching chains', async () => {
    const oldProvider = makeMockProvider('ethereum');
    const newProvider = makeMockProvider('polygon-mumbai');
    const manager = new PortableAnchorManager(oldProvider);

    await manager.switchAnchorChain(newProvider);

    // New receipts should use the new provider
    await manager.anchorReceipt('0xnewreceipt');
    expect(newProvider.anchor).toHaveBeenCalledWith('0xnewreceipt');
    expect(oldProvider.anchor).not.toHaveBeenCalled();
  });

  it('throws when no provider found for historical chain', async () => {
    const provider = makeMockProvider('polygon-mumbai');
    const manager = new PortableAnchorManager(provider);

    const unknownProof: AnchorProof = { chainId: 'unknown-chain', txHash: '0xtx' };

    await expect(manager.verifyHistoricalProof(unknownProof)).rejects.toThrow(
      'No provider found for chain unknown-chain'
    );
  });

  it('supports multiple chain switches and maintains full history', async () => {
    const provider1 = makeMockProvider('chain-1');
    const provider2 = makeMockProvider('chain-2');
    const provider3 = makeMockProvider('chain-3');

    const manager = new PortableAnchorManager(provider1);
    await manager.switchAnchorChain(provider2);
    await manager.switchAnchorChain(provider3);

    // chain-1 should still be accessible
    const proof1: AnchorProof = { chainId: 'chain-1', txHash: '0xtx1' };
    await manager.verifyHistoricalProof(proof1);
    expect(provider1.verifyAnchor).toHaveBeenCalledWith(proof1);

    // chain-2 should also be accessible
    const proof2: AnchorProof = { chainId: 'chain-2', txHash: '0xtx2' };
    await manager.verifyHistoricalProof(proof2);
    expect(provider2.verifyAnchor).toHaveBeenCalledWith(proof2);

    // chain-3 is active - verifyHistoricalProof uses active provider
    const proof3: AnchorProof = { chainId: 'chain-3', txHash: '0xtx3' };
    await manager.verifyHistoricalProof(proof3);
    expect(provider3.verifyAnchor).toHaveBeenCalledWith(proof3);
  });

  it('returns false when active provider verifyAnchor returns false', async () => {
    const provider = makeMockProvider('chain-a');
    provider.verifyAnchor.mockResolvedValue(false);
    const manager = new PortableAnchorManager(provider);

    const proof: AnchorProof = { chainId: 'chain-a', txHash: '0xinvalid' };
    const result = await manager.verifyHistoricalProof(proof);

    expect(result).toBe(false);
  });
});
