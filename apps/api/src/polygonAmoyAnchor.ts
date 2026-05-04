/**
 * polygonAmoyAnchor.ts — Polygon Amoy EVM anchor for TrustSignal receipts.
 *
 * Anchors receipt hashes to the Polygon Amoy testnet (chainId 80002) or
 * Polygon PoS Mainnet (chainId 137) via a deployed AnchorRegistry contract.
 *
 * This is the "decentralized immutability" pillar of the hybrid anchoring model:
 * Polygon PoS ensures the evidence trail outlives any single vendor.
 *
 * Supported networks:
 *   Amoy testnet  — chainId 80002  (default for staging/demo)
 *   PoS Mainnet   — chainId 137    (production)
 *
 * Required env vars:
 *   POLYGON_AMOY_RPC_URL            — JSON-RPC endpoint (e.g. Alchemy/QuickNode/public)
 *   POLYGON_AMOY_REGISTRY_ADDRESS   — Deployed AnchorRegistry contract address on Amoy
 *   POLYGON_AMOY_PRIVATE_KEY        — Signing key for the anchoring wallet
 *
 * For Polygon PoS Mainnet, set POLYGON_AMOY_NETWORK=mainnet and provide:
 *   POLYGON_MAINNET_RPC_URL
 *   POLYGON_MAINNET_REGISTRY_ADDRESS
 *   POLYGON_MAINNET_PRIVATE_KEY
 */

import { Contract, Interface, JsonRpcProvider, Log, Wallet } from 'ethers';

const ABI = [
  'event Anchored(bytes32 receiptHash, bytes32 subjectDigest, bytes32 anchorId, address sender, uint256 timestamp)',
  'function anchor(bytes32 receiptHash) external returns (bytes32 anchorId)',
  'function anchorWithSubject(bytes32 receiptHash, bytes32 subjectDigest) external returns (bytes32 anchorId)',
  'function isAnchored(bytes32 receiptHash) external view returns (bool)',
  'function isSubjectAnchored(bytes32 subjectDigest) external view returns (bool)',
  'function subjectForReceipt(bytes32 receiptHash) external view returns (bytes32)'
];

export type PolygonAmoyAnchorResult = {
  status: 'ANCHORED' | 'ALREADY_ANCHORED';
  txHash?: string;
  /** "polygon-amoy" | "polygon-mainnet" */
  chainId: string;
  anchorId?: string;
  subjectDigest: string;
  subjectVersion: string;
  anchoredAt?: string;
};

type NetworkMode = 'amoy' | 'mainnet';

function getNetworkMode(): NetworkMode {
  const mode = (process.env.POLYGON_AMOY_NETWORK || 'amoy').toLowerCase();
  return mode === 'mainnet' ? 'mainnet' : 'amoy';
}

function getRpcUrl(mode: NetworkMode): string {
  if (mode === 'mainnet') {
    const url = process.env.POLYGON_MAINNET_RPC_URL;
    if (!url) throw new Error('POLYGON_MAINNET_RPC_URL is required for Polygon PoS Mainnet anchoring');
    return url;
  }
  return (
    process.env.POLYGON_AMOY_RPC_URL ||
    'https://rpc-amoy.polygon.technology'
  );
}

function getRegistryAddress(mode: NetworkMode): string {
  const addr = mode === 'mainnet'
    ? process.env.POLYGON_MAINNET_REGISTRY_ADDRESS
    : process.env.POLYGON_AMOY_REGISTRY_ADDRESS;
  if (!addr) {
    throw new Error(
      mode === 'mainnet'
        ? 'POLYGON_MAINNET_REGISTRY_ADDRESS is required'
        : 'POLYGON_AMOY_REGISTRY_ADDRESS is required'
    );
  }
  return addr;
}

function getPrivateKey(mode: NetworkMode): string {
  const key = mode === 'mainnet'
    ? process.env.POLYGON_MAINNET_PRIVATE_KEY
    : process.env.POLYGON_AMOY_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      mode === 'mainnet'
        ? 'POLYGON_MAINNET_PRIVATE_KEY is required'
        : 'POLYGON_AMOY_PRIVATE_KEY is required'
    );
  }
  return key;
}

function parseAnchoredAtTimestamp(rawTimestamp: unknown): string | undefined {
  if (typeof rawTimestamp === 'bigint') {
    return new Date(Number(rawTimestamp) * 1000).toISOString();
  }
  if (typeof rawTimestamp === 'number') {
    return new Date(rawTimestamp * 1000).toISOString();
  }
  if (typeof rawTimestamp === 'string' && rawTimestamp.length > 0) {
    const parsed = Number(rawTimestamp);
    if (!Number.isNaN(parsed)) return new Date(parsed * 1000).toISOString();
  }
  return undefined;
}

/**
 * Anchor a receipt hash on Polygon Amoy or PoS Mainnet via the AnchorRegistry contract.
 *
 * The subjectDigest embeds the ZKP commitment so cross-chain verification is unambiguous.
 */
export async function anchorReceiptOnPolygonAmoy(
  receiptHash: string,
  subjectDigest: string,
  subjectVersion: string
): Promise<PolygonAmoyAnchorResult> {
  const mode = getNetworkMode();
  const rpcUrl = getRpcUrl(mode);
  const registryAddress = getRegistryAddress(mode);
  const privateKey = getPrivateKey(mode);

  const networkLabel = mode === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy';

  const provider = new JsonRpcProvider(rpcUrl);
  const wallet = new Wallet(privateKey, provider);
  const registry = new Contract(registryAddress, ABI, wallet);

  const alreadyAnchored = await (registry.isAnchored as (hash: string) => Promise<boolean>)(receiptHash);
  if (alreadyAnchored) {
    const existingSubjectDigest = await (registry.subjectForReceipt as (hash: string) => Promise<string>)(receiptHash);
    return {
      status: 'ALREADY_ANCHORED',
      chainId: networkLabel,
      subjectDigest: existingSubjectDigest || subjectDigest,
      subjectVersion
    };
  }

  const tx = await (registry.anchorWithSubject as (r: string, s: string) => Promise<{ wait: () => Promise<{ hash: string; logs: Log[] } | null> }>)(receiptHash, subjectDigest);
  const receipt = await tx.wait();
  const iface = new Interface(ABI);

  const parsedLog = (receipt?.logs as Log[] | undefined)
    ?.map((log) => {
      try { return iface.parseLog(log); } catch { return null; }
    })
    .find((entry) => entry?.name === 'Anchored');

  const anchorId = parsedLog?.args?.anchorId ?? undefined;
  const anchoredAt = parseAnchoredAtTimestamp(parsedLog?.args?.timestamp);
  const resolvedSubjectDigest = parsedLog?.args?.subjectDigest ?? subjectDigest;

  return {
    status: 'ANCHORED',
    txHash: receipt?.hash,
    chainId: networkLabel,
    anchorId,
    subjectDigest: resolvedSubjectDigest,
    subjectVersion,
    anchoredAt
  };
}

/**
 * Check whether a receipt is already anchored on Polygon Amoy/Mainnet.
 * Returns the existing result if found, or null if not anchored.
 */
export async function findPolygonAmoyAnchor(
  receiptHash: string,
  subjectDigest: string,
  subjectVersion: string
): Promise<PolygonAmoyAnchorResult | null> {
  const mode = getNetworkMode();
  const rpcUrl = getRpcUrl(mode);
  const registryAddress = getRegistryAddress(mode);

  const networkLabel = mode === 'mainnet' ? 'polygon-mainnet' : 'polygon-amoy';

  const provider = new JsonRpcProvider(rpcUrl);
  const registry = new Contract(registryAddress, ABI, provider);

  const isAnchored = await (registry.isAnchored as (hash: string) => Promise<boolean>)(receiptHash);
  if (!isAnchored) return null;

  const existingSubjectDigest = await (registry.subjectForReceipt as (hash: string) => Promise<string>)(receiptHash);

  return {
    status: 'ALREADY_ANCHORED',
    chainId: networkLabel,
    subjectDigest: existingSubjectDigest || subjectDigest,
    subjectVersion
  };
}
