import type { BundleInput, Receipt, UnsignedReceiptPayload } from './types.js';
import { canonicalizeJson } from './canonicalize.js';
import { keccak256Utf8 } from './hashing.js';

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
    ...(receipt.signing_key_id ? { signing_key_id: receipt.signing_key_id } : {}),
    fraudRisk: receipt.fraudRisk,
    zkpAttestation: receipt.zkpAttestation
  };
}
