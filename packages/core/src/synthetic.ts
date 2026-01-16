import { randomUUID } from 'crypto';

import { Wallet, keccak256, toUtf8Bytes } from 'ethers';

import { BundleInput, TrustRegistry } from './types.js';

export type SyntheticRegistry = {
  registry: TrustRegistry;
  notaryWallets: Record<string, Wallet>;
};

const STATES = ['CA', 'NY', 'TX', 'FL', 'WA'];

export function createSyntheticRegistry(notaryCount = 5): SyntheticRegistry {
  const notaryWallets: Record<string, Wallet> = {};
  const notaries = Array.from({ length: notaryCount }).map((_, index) => {
    const id = `NOTARY-${index + 1}`;
    const wallet = deriveNotaryWallet(id);
    notaryWallets[id] = wallet;
    return {
      id,
      name: `Synthetic Notary ${index + 1}`,
      commissionState: STATES[index % STATES.length],
      status: 'ACTIVE' as const,
      publicKey: wallet.address,
      validFrom: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      validTo: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
    };
  });

  const registry: TrustRegistry = {
    version: '1.0',
    issuedAt: new Date().toISOString(),
    issuer: 'Synthetic Trust Registry',
    signingKeyId: 'registry-key-1',
    ronProviders: [
      { id: 'RON-1', name: 'Synthetic RON One', status: 'ACTIVE' },
      { id: 'RON-2', name: 'Synthetic RON Two', status: 'SUSPENDED' }
    ],
    notaries
  };

  return { registry, notaryWallets };
}

export function deriveNotaryWallet(notaryId: string): Wallet {
  const seed = keccak256(toUtf8Bytes(`notary:${notaryId}`));
  return new Wallet(seed);
}

export async function signDocHash(wallet: Wallet, docHash: string): Promise<string> {
  const signature = await wallet.signMessage(docHash);
  return `v1:${signature}`;
}

function randomChoice<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export async function generateSyntheticBundles(
  registry: TrustRegistry,
  notaryWallets: Record<string, Wallet>,
  count: number,
  fraudRate = 0.2
): Promise<BundleInput[]> {
  const bundles: BundleInput[] = [];
  for (let i = 0; i < count; i += 1) {
    const notary = randomChoice(registry.notaries);
    const docSeed = `${randomUUID()}-${i}`;
    const docHash = keccak256(toUtf8Bytes(docSeed));
    const isFraud = Math.random() < fraudRate;
    const policyProfile = Math.random() < 0.5 ? `STANDARD_${notary.commissionState}` : `STRICT_${notary.commissionState}`;
    const transactionType = Math.random() < 0.2 ? 'quitclaim' : 'warranty';

    let sealPayload = await signDocHash(notaryWallets[notary.id], docHash);
    let commissionState = notary.commissionState;
    let bundleId = `BUNDLE-${i + 1}`;

    if (isFraud) {
      const fraudType = Math.floor(Math.random() * 3);
      if (fraudType === 0) {
        sealPayload = 'v1:0xdeadbeef';
      } else if (fraudType === 1) {
        commissionState = randomChoice(STATES.filter((state) => state !== notary.commissionState));
      } else {
        bundleId = `RAPID-${bundleId}`;
      }
    }

    bundles.push({
      bundleId,
      transactionType,
      ron: {
        provider: 'RON-1',
        notaryId: notary.id,
        commissionState,
        sealPayload,
        sealScheme: 'SIM-ECDSA-v1'
      },
      doc: { docHash },
      property: {
        parcelId: isFraud && Math.random() < 0.3 ? 'SCAM-101' : `PARCEL-${i}`,
        county: 'Demo County',
        state: notary.commissionState
      },
      policy: { profile: policyProfile },
      timestamp: new Date().toISOString()
    });
  }

  return bundles;
}

export function generateTrustRegistry(): TrustRegistry {
  return createSyntheticRegistry().registry;
}

export function generateBundle(registry: TrustRegistry): BundleInput {
  const notary = registry.notaries[0];
  return {
    bundleId: `TEST-${Date.now()}`,
    transactionType: 'warranty',
    ron: {
      provider: 'RON-1',
      notaryId: notary.id,
      commissionState: notary.commissionState,
      sealPayload: 'v1:mock-signature'
    },
    doc: { docHash: '0x123' },
    property: {
      parcelId: 'PARCEL-12345',
      county: 'Demo County',
      state: notary.commissionState
    },
    policy: { profile: 'STANDARD' },
    timestamp: new Date().toISOString()
  };
}
