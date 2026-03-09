import { randomUUID } from 'crypto';

import { canonicalizeJson } from './canonicalize.js';
import { keccak256Utf8 } from './hashing.js';
import { BundleInput, Receipt, UnsignedReceiptPayload, VerificationResult } from './types.js';

export function computeInputsCommitment(input: BundleInput): string {
  return keccak256Utf8(canonicalizeJson(input));
}

export function computeReceiptHash(receipt: UnsignedReceiptPayload): string {
  return keccak256Utf8(canonicalizeJson(receipt));
}

export function toUnsignedReceiptPayload(receipt: Receipt): UnsignedReceiptPayload {
  return {
    receiptVersion: receipt.receiptVersion,
    receiptId: receipt.receiptId,
    createdAt: receipt.createdAt,
    policyProfile: receipt.policyProfile,
    inputsCommitment: receipt.inputsCommitment,
    checks: receipt.checks,
    decision: receipt.decision,
    reasons: receipt.reasons,
    riskScore: receipt.riskScore,
    verifierId: receipt.verifierId,
    fraudRisk: receipt.fraudRisk,
    zkpAttestation: receipt.zkpAttestation
  };
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
  const baseReceipt: UnsignedReceiptPayload = {
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
