import { CompactSign, compactVerify, decodeProtectedHeader, importJWK, type JWK } from 'jose';

import { canonicalizeJson } from './canonicalize.js';
import { ReceiptSignature, UnsignedReceiptPayload } from './types.js';

export type ReceiptSigner = {
  privateJwk: JWK;
  kid: string;
  alg?: 'EdDSA';
};

export type ReceiptVerifierKeyStore = Map<string, JWK> | Record<string, JWK>;

export type ReceiptSignatureVerification = {
  verified: boolean;
  keyResolved: boolean;
  payloadMatches: boolean;
  kid: string;
  alg: string;
  reason?: string;
};

function toKeyStoreMap(keyStore: ReceiptVerifierKeyStore): Map<string, JWK> {
  if (keyStore instanceof Map) {
    return keyStore;
  }

  return new Map(Object.entries(keyStore));
}

export function canonicalizeUnsignedReceiptPayload(payload: UnsignedReceiptPayload): string {
  return canonicalizeJson(payload);
}

export async function signReceiptPayload(
  payload: UnsignedReceiptPayload,
  signer: ReceiptSigner
): Promise<ReceiptSignature> {
  const alg = signer.alg || 'EdDSA';
  const key = await importJWK(signer.privateJwk, alg);
  const encodedPayload = new TextEncoder().encode(canonicalizeUnsignedReceiptPayload(payload));

  const signature = await new CompactSign(encodedPayload)
    .setProtectedHeader({ alg, kid: signer.kid, typ: 'receipt+jws' })
    .sign(key);

  return {
    signature,
    alg,
    kid: signer.kid
  };
}

export async function verifyReceiptSignature(
  payload: UnsignedReceiptPayload,
  receiptSignature: ReceiptSignature,
  keyStore: ReceiptVerifierKeyStore
): Promise<ReceiptSignatureVerification> {
  const keys = toKeyStoreMap(keyStore);

  try {
    const header = decodeProtectedHeader(receiptSignature.signature);
    const alg = typeof header.alg === 'string' ? header.alg : receiptSignature.alg;
    const kid = typeof header.kid === 'string' ? header.kid : receiptSignature.kid;
    const publicJwk = keys.get(kid);

    if (!publicJwk) {
      return {
        verified: false,
        keyResolved: false,
        payloadMatches: false,
        kid,
        alg,
        reason: 'unknown_kid'
      };
    }

    const key = await importJWK(publicJwk, alg);
    const { payload: verifiedPayload, protectedHeader } = await compactVerify(receiptSignature.signature, key);
    const payloadString = new TextDecoder().decode(verifiedPayload);
    const expectedPayload = canonicalizeUnsignedReceiptPayload(payload);
    const payloadMatches = payloadString === expectedPayload;
    const signatureMatchesMetadata = protectedHeader.alg === receiptSignature.alg && protectedHeader.kid === receiptSignature.kid;
    const verified = payloadMatches && signatureMatchesMetadata;

    return {
      verified,
      keyResolved: true,
      payloadMatches,
      kid,
      alg,
      reason: verified ? undefined : payloadMatches ? 'signature_metadata_mismatch' : 'payload_mismatch'
    };
  } catch (error) {
    return {
      verified: false,
      keyResolved: false,
      payloadMatches: false,
      kid: receiptSignature.kid,
      alg: receiptSignature.alg,
      reason: error instanceof Error ? error.message : 'signature_verification_failed'
    };
  }
}
