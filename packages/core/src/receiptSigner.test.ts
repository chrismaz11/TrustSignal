import { describe, expect, it } from 'vitest';

import { buildReceipt, computeReceiptHash, toUnsignedReceiptPayload } from './receipt.js';
import {
  signReceiptPayload,
  verifyReceiptSignature
} from './receiptSigner.js';
import { generateRegistryKeypair } from './registry.js';
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

  it('includes signing_key_id in receipts and verifies with the matching key', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const notary = registry.notaries[0];
    const docHash = '0x7777777777777777777777777777777777777777777777777777777777777777';
    const signingKeyId = 'dev-test-receipt-signer-v2';
    const bundle = {
      bundleId: 'BUNDLE-RECEIPT-KEYID-1',
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
    const receipt = buildReceipt(bundle, verification, 'deed-shield', { signing_key_id: signingKeyId });
    const unsignedPayload = toUnsignedReceiptPayload(receipt);
    expect(unsignedPayload.signing_key_id).toBe(signingKeyId);

    const signingKeypair = await generateRegistryKeypair();
    const otherKeypair = await generateRegistryKeypair();
    const receiptSignature = await signReceiptPayload(unsignedPayload, {
      privateJwk: signingKeypair.privateJwk,
      kid: signingKeyId
    });

    const verified = await verifyReceiptSignature(unsignedPayload, receiptSignature, {
      [signingKeyId]: signingKeypair.publicJwk,
      'dev-test-receipt-signer-other': otherKeypair.publicJwk
    });

    expect(verified.verified).toBe(true);
    expect(verified.kid).toBe(signingKeyId);
  });

  it('fails verification when signing_key_id is unknown', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const notary = registry.notaries[0];
    const docHash = '0x8888888888888888888888888888888888888888888888888888888888888888';
    const signingKeyId = 'dev-test-receipt-signer-unknown';
    const bundle = {
      bundleId: 'BUNDLE-RECEIPT-KEYID-2',
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
    const receipt = buildReceipt(bundle, verification, 'deed-shield', { signing_key_id: signingKeyId });
    const unsignedPayload = toUnsignedReceiptPayload(receipt);
    const keypair = await generateRegistryKeypair();
    const receiptSignature = await signReceiptPayload(unsignedPayload, {
      privateJwk: keypair.privateJwk,
      kid: signingKeyId
    });

    const verified = await verifyReceiptSignature(unsignedPayload, receiptSignature, {});
    expect(verified.verified).toBe(false);
    expect(verified.keyResolved).toBe(false);
    expect(verified.reason).toBe('unknown_kid');
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

  it('returns a structured invalid result for malformed receipt signatures', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const notary = registry.notaries[0];
    const docHash = '0x9999999999999999999999999999999999999999999999999999999999999999';
    const bundle = {
      bundleId: 'BUNDLE-RECEIPT-3',
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

    const malformed = await verifyReceiptSignature(
      unsignedPayload,
      {
        signature: 'not-a-jws',
        alg: 'EdDSA',
        kid: 'dev-test-receipt-signer-v1'
      },
      {}
    );

    expect(malformed.verified).toBe(false);
    expect(malformed.keyResolved).toBe(false);
    expect(malformed.payloadMatches).toBe(false);
  });
});
