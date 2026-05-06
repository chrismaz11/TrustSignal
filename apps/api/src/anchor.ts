import { Contract, Interface, JsonRpcProvider, Log, Wallet } from 'ethers';

import {
  ANCHOR_SUBJECT_VERSION,
  buildAnchorSubject as buildCoreAnchorSubject,
  type ZKPAttestation
} from '../../../packages/core/dist/index.js';

import { anchorReceiptOnSolana, findSolanaAnchor } from './solanaAnchor.js';
import { anchorReceiptOnPolygonAmoy, findPolygonAmoyAnchor } from './polygonAmoyAnchor.js';

export { ANCHOR_SUBJECT_VERSION } from '../../../packages/core/dist/index.js';
export { anchorReceiptOnSolana, findSolanaAnchor } from './solanaAnchor.js';
export { anchorReceiptOnPolygonAmoy, findPolygonAmoyAnchor } from './polygonAmoyAnchor.js';
export { stampWithRfc3161, verifyRfc3161TokenHash } from './rfc3161Anchor.js';

const ABI = [
  'event Anchored(bytes32 receiptHash, bytes32 subjectDigest, bytes32 anchorId, address sender, uint256 timestamp)',
  'function anchor(bytes32 receiptHash) external returns (bytes32 anchorId)',
  'function anchorWithSubject(bytes32 receiptHash, bytes32 subjectDigest) external returns (bytes32 anchorId)',
  'function isAnchored(bytes32 receiptHash) external view returns (bool)',
  'function isSubjectAnchored(bytes32 subjectDigest) external view returns (bool)',
  'function subjectForReceipt(bytes32 receiptHash) external view returns (bytes32)'
];

export type AnchorChain = 'evm' | 'solana' | 'polygon-amoy';

export type AnchorResult = {
  status: 'ANCHORED' | 'ALREADY_ANCHORED';
  chain: AnchorChain;
  txHash?: string;
  chainId?: string;
  anchorId?: string;
  subjectDigest: string;
  subjectVersion: typeof ANCHOR_SUBJECT_VERSION;
  anchoredAt?: string;
};

export function buildAnchorSubject(receiptHash: string, attestation?: ZKPAttestation): {
  version: typeof ANCHOR_SUBJECT_VERSION;
  digest: string;
} {
  const subject = buildCoreAnchorSubject(receiptHash, attestation);

  return {
    version: subject.version,
    digest: subject.hash
  };
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
    if (!Number.isNaN(parsed)) {
      return new Date(parsed * 1000).toISOString();
    }
  }
  return undefined;
}

export async function anchorReceipt(receiptHash: string, attestation?: ZKPAttestation): Promise<AnchorResult> {
  const registryAddress = process.env.ANCHOR_REGISTRY_ADDRESS;
  if (!registryAddress) {
    throw new Error('ANCHOR_REGISTRY_ADDRESS is required');
  }

  const rpcUrl =
    (process.env.SEPOLIA_RPC_URL || process.env.RPC_URL) && process.env.PRIVATE_KEY
      ? (process.env.SEPOLIA_RPC_URL || process.env.RPC_URL)!
      : process.env.LOCAL_CHAIN_URL || 'http://127.0.0.1:8545';

  const privateKey = process.env.PRIVATE_KEY || process.env.LOCAL_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('Missing PRIVATE_KEY or LOCAL_PRIVATE_KEY');
  }

  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  const chainId = network.chainId.toString();
  const wallet = new Wallet(privateKey, provider);
  const registry = new Contract(registryAddress, ABI, wallet);
  const subject = buildAnchorSubject(receiptHash, attestation);

  const alreadyAnchored = await registry.isAnchored(receiptHash);
  if (alreadyAnchored) {
    const existingSubjectDigest = await registry.subjectForReceipt(receiptHash);
    return {
      status: 'ALREADY_ANCHORED',
      chain: 'evm',
      chainId,
      subjectDigest: existingSubjectDigest || subject.digest,
      subjectVersion: subject.version
    };
  }

  const tx = await registry.anchorWithSubject(receiptHash, subject.digest);
  const receipt = await tx.wait();
  const iface = new Interface(ABI);
  const parsedLog = (receipt?.logs as Log[] | undefined)
    ?.map((log) => {
      try {
        return iface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.name === 'Anchored');
  const anchorId = parsedLog?.args?.anchorId ?? undefined;
  const anchoredAt = parseAnchoredAtTimestamp(parsedLog?.args?.timestamp);
  const subjectDigest = parsedLog?.args?.subjectDigest ?? subject.digest;

  return {
    status: 'ANCHORED',
    chain: 'evm',
    txHash: receipt?.hash,
    chainId,
    anchorId,
    subjectDigest,
    subjectVersion: subject.version,
    anchoredAt
  };
}

/**
 * Anchor a receipt on a specific chain (evm or solana).
 * For EVM, delegates to anchorReceipt (Sepolia/local hardhat).
 * For Solana, writes a memo transaction using the SPL Memo program.
 */
export async function anchorReceiptOnChain(
  receiptHash: string,
  chain: AnchorChain,
  attestation?: ZKPAttestation
): Promise<AnchorResult> {
  if (chain === 'solana') {
    const subject = buildAnchorSubject(receiptHash, attestation);
    // Check if already anchored on Solana before sending a new tx
    const existing = await findSolanaAnchor(receiptHash, subject.digest, subject.version);
    if (existing) {
      return {
        ...existing,
        chain: 'solana',
        subjectVersion: subject.version as typeof ANCHOR_SUBJECT_VERSION
      };
    }
    const result = await anchorReceiptOnSolana(receiptHash, subject.digest, subject.version);
    return {
      ...result,
      chain: 'solana',
      subjectVersion: result.subjectVersion as typeof ANCHOR_SUBJECT_VERSION
    };
  }

  if (chain === 'polygon-amoy') {
    const subject = buildAnchorSubject(receiptHash, attestation);
    // Check if already anchored on Polygon Amoy before sending a new tx
    const existing = await findPolygonAmoyAnchor(receiptHash, subject.digest, subject.version);
    if (existing) {
      return {
        ...existing,
        chain: 'polygon-amoy',
        subjectVersion: subject.version as typeof ANCHOR_SUBJECT_VERSION
      };
    }
    const result = await anchorReceiptOnPolygonAmoy(receiptHash, subject.digest, subject.version);
    return {
      ...result,
      chain: 'polygon-amoy',
      subjectVersion: result.subjectVersion as typeof ANCHOR_SUBJECT_VERSION
    };
  }

  // Default: EVM (Sepolia / local hardhat)
  return anchorReceipt(receiptHash, attestation);
}
