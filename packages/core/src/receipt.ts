import { randomUUID } from 'crypto';

import { SignJWT, importPKCS8 } from 'jose';

import { canonicalizeJson } from './canonicalize.js';
import { keccak256Utf8 } from './hashing.js';
import { BundleInput, Receipt, VerificationResult } from './types.js';

export function computeInputsCommitment(input: BundleInput): string {
  return keccak256Utf8(canonicalizeJson(input));
}

export function computeReceiptHash(receipt: Omit<Receipt, 'receiptHash'>): string {
  return keccak256Utf8(canonicalizeJson(receipt));
}

export function buildReceipt(
  input: BundleInput,
  verification: VerificationResult,
  verifierId = 'deed-shield',
  extensions: {
    fraudRisk?: Receipt['fraudRisk'];
    zkpAttestation?: Receipt['zkpAttestation'];
  } = {}
): Receipt {
  const receiptId = randomUUID();
  const createdAt = new Date().toISOString();
  const inputsCommitment = computeInputsCommitment(input);
  const baseReceipt: Omit<Receipt, 'receiptHash'> = {
    receiptVersion: '1.0',
    receiptId,
    createdAt,
    policyProfile: input.policy.profile,
    inputsCommitment,
    checks: verification.checks,
    decision: verification.decision,
    reasons: verification.reasons,
    riskScore: verification.riskScore,
    verifierId,
    fraudRisk: extensions.fraudRisk,
    zkpAttestation: extensions.zkpAttestation
  };
  const receiptHash = computeReceiptHash(baseReceipt);
  return { ...baseReceipt, receiptHash };
}

export async function signReceipt(
  receipt: Receipt,
  signingKeyPem: string,
  issuerDid: string,
  documentHash: string,
  notaryIdentifier: string
): Promise<string> {
  const privateKey = await importPKCS8(signingKeyPem, 'ES256');

  const jwt = await new SignJWT({
    ...receipt,
    documentHash,
    notaryIdentifier,
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(issuerDid)
    .setSubject(receipt.receiptId)
    .sign(privateKey);

  return jwt;
}
