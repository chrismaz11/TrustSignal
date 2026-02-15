
import { Wallet, JsonRpcProvider, TransactionResponse } from 'ethers';
import { AnchorProvider, AnchorProof } from './portable.js';

export class PolygonAnchorProvider implements AnchorProvider {
  public readonly chainId: string;
  private provider: JsonRpcProvider;
  private wallet: Wallet;

  constructor(
    rpcUrl: string,
    privateKey: string,
    chainId: string = '137' // Polygon Mainnet default
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
    this.wallet = new Wallet(privateKey, this.provider);
    this.chainId = chainId;
  }

  /**
   * Anchors a receipt hash to the Polygon blockchain by sending a transaction
   * with the hash as data.
   * NOTE: In a real production system, this might interact with a specific
   * Smart Contract Registry. For this implementation, we use a self-transaction
   * with data to ensure the hash is recorded on-chain.
   */
  async anchor(receiptHash: string): Promise<AnchorProof> {
    // Ensure 0x prefix for hex data
    const data = receiptHash.startsWith('0x') ? receiptHash : `0x${receiptHash}`;

    // Send transaction to self with the hash in data
    const tx: TransactionResponse = await this.wallet.sendTransaction({
      to: this.wallet.address,
      data: data,
      value: 0
    });

    // Wait for confirmation (optional, but good for returning proof)
    const receipt = await tx.wait(1);
    
    if (!receipt) {
      throw new Error('Transaction failed or was dropped');
    }

    return {
      chainId: this.chainId,
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      timestamp: new Date().toISOString() // Block timestamp would be better if fetched
    };
  }

  async verifyAnchor(proof: AnchorProof): Promise<boolean> {
    // Verify that the transaction exists and contains the expected data would go here.
    // For now, we just check if the tx is on chain.
    const tx = await this.provider.getTransaction(proof.txHash);
    if (!tx) return false;
    
    // In a real verifier, we would check if tx.data matches the receipt hash.
    // For this stub, existence is enough.
    return !!tx.blockNumber;
  }
}
