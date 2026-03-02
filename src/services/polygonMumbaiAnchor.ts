import { createHash } from 'node:crypto';

import { JsonRpcProvider, Wallet } from 'ethers';

const MUMBAI_CHAIN_ID = 80_001n;

export interface PolygonAnchorResult {
  tx_hash: string;
  timestamp: string;
  nullifier_hash: string;
}

function normalizeBundleHash(bundleHash: string): string {
  return bundleHash.trim().toLowerCase();
}

function buildNullifierHash(bundleHash: string): string {
  return createHash('sha256').update(normalizeBundleHash(bundleHash)).digest('hex');
}

export async function anchorNullifierToPolygonMumbai(bundleHash: string): Promise<PolygonAnchorResult> {
  const rpcUrl = process.env.POLYGON_MUMBAI_RPC_URL;
  const privateKey = process.env.POLYGON_MUMBAI_PRIVATE_KEY;

  if (!rpcUrl || !privateKey) {
    throw new Error('POLYGON_MUMBAI_RPC_URL and POLYGON_MUMBAI_PRIVATE_KEY are required');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (network.chainId !== MUMBAI_CHAIN_ID) {
    throw new Error(`Mumbai chainId mismatch. Expected ${MUMBAI_CHAIN_ID}, got ${network.chainId}`);
  }

  const nullifierHash = buildNullifierHash(bundleHash);
  const signer = new Wallet(privateKey, provider);
  const transaction = await signer.sendTransaction({
    to: signer.address,
    value: 0n,
    data: `0x${nullifierHash}`
  });

  await transaction.wait();

  return {
    tx_hash: transaction.hash,
    timestamp: new Date().toISOString(),
    nullifier_hash: nullifierHash
  };
}
