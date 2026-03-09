import { describe, expect, it } from 'vitest';

import { buildReceipt, computeReceiptHash, generateRegistryKeypair, signReceiptPayload, toUnsignedReceiptPayload, verifyReceiptSignature } from './index.js';
import { createSyntheticRegistry, signDocHash } from './synthetic.js';
import { verifyBundle } from './verification.js';

describe('receipt signing', () => {
  it('preserves receiptHash stability when adding signatures', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const notary = registry.notaries[0];
    const docHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const bundle = {
      bundleId: 'BUNDLE-RECEIPT-1',
      transactionType: 'warranty',
      ron: {
        provider: 'RON-1',
        notaryId: notary.id,
        commissionState: notary.commissionState,
        sealPayload: await signDocHash(notaryWallets[notary.id], docHash),
        sealScheme: 'SIM-ECDSA-v1' as const
      },
      doc: { docHash },
      property: {
        parcelId: 'PARCEL-12345',
        county: 'Demo County',
        state: notary.commissionState
      },
      policy: { profile: `STANDARD_${notary.commissionState}` },
      timestamp: new Date().toISOString()
    };
    const verification = await verifyBundle(bundle, registry);
    const receipt = buildReceipt(bundle, verification, 'deed-shield');
    const unsignedPayload = toUnsignedReceiptPayload(receipt);
    const { privateJwk } = await generateRegistryKeypair();

    const originalHash = receipt.receiptHash;
    const signature = await signReceiptPayload(unsignedPayload, {
      privateJwk,
      kid: 'dev-test-receipt-signer-v1'
    });

    expect(receipt.receiptHash).toBe(originalHash);
    expect(computeReceiptHash(unsignedPayload)).toBe(originalHash);
    expect(signature.alg).toBe('EdDSA');
  });

  it('fails verification when the signed payload is mutated', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const notary = registry.notaries[0];
    const docHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd';
    const bundle = {
      bundleId: 'BUNDLE-RECEIPT-2',
      transactionType: 'warranty',
      ron: {
        provider: 'RON-1',
        notaryId: notary.id,
        commissionState: notary.commissionState,
        sealPayload: await signDocHash(notaryWallets[notary.id], docHash),
        sealScheme: 'SIM-ECDSA-v1' as const
      },
      doc: { docHash },
      property: {
        parcelId: 'PARCEL-12345',
        county: 'Demo County',
        state: notary.commissionState
      },
      policy: { profile: `STANDARD_${notary.commissionState}` },
      timestamp: new Date().toISOString()
    };
    const verification = await verifyBundle(bundle, registry);
    const receipt = buildReceipt(bundle, verification, 'deed-shield');
    const unsignedPayload = toUnsignedReceiptPayload(receipt);
    const { privateJwk, publicJwk } = await generateRegistryKeypair();
    const receiptSignature = await signReceiptPayload(unsignedPayload, {
      privateJwk,
      kid: 'dev-test-receipt-signer-v1'
    });

    const verified = await verifyReceiptSignature(
      unsignedPayload,
      receiptSignature,
      { 'dev-test-receipt-signer-v1': publicJwk }
    );
    expect(verified.verified).toBe(true);

    const tampered = await verifyReceiptSignature(
      { ...unsignedPayload, decision: unsignedPayload.decision === 'ALLOW' ? 'BLOCK' : 'ALLOW' },
      receiptSignature,
      { 'dev-test-receipt-signer-v1': publicJwk }
    );

    expect(tampered.verified).toBe(false);
    expect(tampered.keyResolved).toBe(true);
    expect(tampered.payloadMatches).toBe(false);
  });
});
