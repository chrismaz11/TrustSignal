/**
 * ICE Mortgage Technology → TrustSignal adaptor
 *
 * Maps an Encompass loan record to a TrustSignal BundleInput.
 * In a real integration this would consume the live Encompass Developer
 * Connect API response; here it operates on the mock fixture data.
 */

import { randomUUID } from 'node:crypto';
import { keccak256, toUtf8Bytes, Wallet } from 'ethers';

import type { BundleInput } from '../../packages/core/src/types.js';
import type { EncompassLoan } from './mock-ice-api.js';

// Deterministic notary wallet derived from notary ID — mirrors synthetic.ts pattern
function deriveNotaryWallet(notaryId: string): Wallet {
  const seed = keccak256(toUtf8Bytes(`notary:${notaryId}`));
  return new Wallet(seed);
}

async function signDocHash(wallet: Wallet, docHash: string): Promise<string> {
  const signature = await wallet.signMessage(docHash);
  return `v1:${signature}`;
}

function mapTransactionType(encompassType: EncompassLoan['transactionType']): string {
  switch (encompassType) {
    case 'PurchaseMoney': return 'warranty';
    case 'QuitClaim':    return 'quitclaim';
    case 'Refinance':    return 'warranty';
  }
}

export async function adaptLoanToBundle(loan: EncompassLoan): Promise<BundleInput> {
  // Derive document hash from loan data deterministically
  const docSeed = `ice:${loan.loanNumber}:${loan.closingDate}:${loan.propertyAddress}`;
  const docHash = keccak256(toUtf8Bytes(docSeed));

  // Derive seal payload from notary wallet — unless the fixture already has a
  // bad/tampered payload, in which case preserve it as-is (Scenario 3)
  let sealPayload = loan.eClosing.sealPayload;
  if (sealPayload === '__DERIVED__') {
    const wallet = deriveNotaryWallet(loan.eClosing.notaryId);
    sealPayload = await signDocHash(wallet, docHash);
  }

  const policyState = loan.eClosing.notaryCommissionState;

  return {
    bundleId: loan.loanNumber,
    transactionType: mapTransactionType(loan.transactionType),
    ron: {
      provider: loan.eClosing.ronProvider,
      notaryId: loan.eClosing.notaryId,
      commissionState: loan.eClosing.notaryCommissionState,
      sealPayload,
      sealScheme: 'SIM-ECDSA-v1'
    },
    doc: {
      docHash,
      pdfBase64: loan.pdfBase64
    },
    property: {
      parcelId: loan.parcelId,
      county: loan.county,
      state: loan.state
    },
    ocrData: {
      notaryName: loan.eClosing.notaryName,
      propertyAddress: `${loan.propertyAddress}, ${loan.city}, ${loan.state}`
    },
    policy: {
      profile: `STANDARD_${policyState}`
    },
    timestamp: loan.closingDate
  };
}
