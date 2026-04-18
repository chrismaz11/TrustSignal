/**
 * solanaAnchor.ts — Solana anchoring for TrustSignal receipts.
 *
 * Writes the receipt hash as a UTF-8 memo to Solana using the SPL Memo program.
 * This provides a cheap, permissionless on-chain timestamp/proof-of-existence
 * without requiring a custom Solana program deployment.
 *
 * Supported clusters: devnet, mainnet-beta
 * Env vars:
 *   SOLANA_CLUSTER         — "devnet" | "mainnet-beta" (default: "devnet")
 *   SOLANA_RPC_URL         — custom RPC endpoint (optional; falls back to public cluster URL)
 *   SOLANA_PAYER_SECRET_KEY — base58 or JSON array secret key for the fee payer
 */

import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
  TransactionInstruction
} from '@solana/web3.js';

// SPL Memo program v2 — deployed on all Solana clusters
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export type SolanaAnchorResult = {
  status: 'ANCHORED' | 'ALREADY_ANCHORED';
  txHash?: string;
  /** "solana-devnet" | "solana-mainnet-beta" */
  chainId: string;
  subjectDigest: string;
  subjectVersion: string;
  anchoredAt?: string;
};

function getCluster(): string {
  return process.env.SOLANA_CLUSTER || 'devnet';
}

function getRpcUrl(): string {
  if (process.env.SOLANA_RPC_URL?.trim()) {
    return process.env.SOLANA_RPC_URL.trim();
  }
  const cluster = getCluster();
  if (cluster === 'devnet' || cluster === 'mainnet-beta' || cluster === 'testnet') {
    return clusterApiUrl(cluster as 'devnet' | 'mainnet-beta' | 'testnet');
  }
  return clusterApiUrl('devnet');
}

function loadPayerKeypair(): Keypair {
  const raw = process.env.SOLANA_PAYER_SECRET_KEY;
  if (!raw) {
    throw new Error('SOLANA_PAYER_SECRET_KEY is required for Solana anchoring');
  }
  const trimmed = raw.trim();
  // Expects JSON array format: [1,2,3,...] (standard Solana keypair export format)
  // Generate with: solana-keygen new --outfile keypair.json
  if (!trimmed.startsWith('[')) {
    throw new Error('SOLANA_PAYER_SECRET_KEY must be a JSON array (e.g. from solana-keygen new --outfile keypair.json)');
  }
  const arr = JSON.parse(trimmed) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(arr));
}

function buildChainId(): string {
  return `solana-${getCluster()}`;
}

/**
 * Anchor a receipt hash on Solana using the SPL Memo program.
 *
 * The memo payload is:
 *   trustsignal:anchor:v1:{receiptHash}:{subjectDigest}
 *
 * This embeds both the receipt hash and the subject digest (ZKP commitment)
 * in a single on-chain record, making cross-chain verification unambiguous.
 */
export async function anchorReceiptOnSolana(
  receiptHash: string,
  subjectDigest: string,
  subjectVersion: string
): Promise<SolanaAnchorResult> {
  const chainId = buildChainId();
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const payer = loadPayerKeypair();

  // Memo content that encodes the anchor subject for verification
  const memoText = `trustsignal:anchor:v1:${receiptHash}:${subjectDigest}`;
  const memoData = Buffer.from(memoText, 'utf8');

  const ix = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [],
    data: memoData
  });

  const tx = new Transaction().add(ix);
  const signature = await sendAndConfirmTransaction(connection, tx, [payer]);

  const slot = await connection.getSlot('confirmed');
  const blockTime = await connection.getBlockTime(slot);
  const anchoredAt = blockTime ? new Date(blockTime * 1000).toISOString() : new Date().toISOString();

  return {
    status: 'ANCHORED',
    txHash: signature,
    chainId,
    subjectDigest,
    subjectVersion,
    anchoredAt
  };
}

/**
 * Check whether a receipt is already anchored on Solana by querying
 * the transaction history of the memo program for this payer.
 *
 * Returns the existing anchor result if found, or null if not anchored.
 */
export async function findSolanaAnchor(
  receiptHash: string,
  subjectDigest: string,
  subjectVersion: string
): Promise<SolanaAnchorResult | null> {
  const connection = new Connection(getRpcUrl(), 'confirmed');
  const payer = loadPayerKeypair();
  const chainId = buildChainId();

  const expectedMemo = `trustsignal:anchor:v1:${receiptHash}:${subjectDigest}`;

  // Look back through recent transactions from this payer for a matching memo
  const signatures = await connection.getSignaturesForAddress(payer.publicKey, { limit: 1000 });

  for (const sigInfo of signatures) {
    const tx = await connection.getTransaction(sigInfo.signature, {
      maxSupportedTransactionVersion: 0
    });
    if (!tx) continue;

    const message = tx.transaction.message;
    // Check compiled instructions for memo data
    const compiledInstructions = 'compiledInstructions' in message
      ? (message as { compiledInstructions: Array<{ data: Uint8Array; programIdIndex: number }> }).compiledInstructions
      : [];

    for (const ix of compiledInstructions) {
      try {
        const memoText = Buffer.from(ix.data).toString('utf8');
        if (memoText === expectedMemo) {
          const anchoredAt = sigInfo.blockTime
            ? new Date(sigInfo.blockTime * 1000).toISOString()
            : undefined;
          return {
            status: 'ALREADY_ANCHORED',
            txHash: sigInfo.signature,
            chainId,
            subjectDigest,
            subjectVersion,
            anchoredAt
          };
        }
      } catch {
        // Not a UTF-8 memo, skip
      }
    }
  }

  return null;
}
