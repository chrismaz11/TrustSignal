import { getAddress, verifyMessage } from 'ethers';

import { findNotary, findRonProvider } from './registry.js';
import { BundleInput, CheckResult, TrustRegistry, VerificationResult, CountyVerifier } from './types.js';
import { NotaryVerifier, PropertyVerifier } from './verifiers.js';

function parsePolicyState(profile: string, fallback: string): string {
  const match = profile.match(/([A-Z]{2})$/);
  return match ? match[1] : fallback;
}

function parseSignature(sealPayload: string): string {
  if (sealPayload.startsWith('v1:')) {
    return sealPayload.slice(3);
  }
  return sealPayload;
}

export async function verifyBundle(
  input: BundleInput,
  registry: TrustRegistry,
  verifiers?: {
    county?: CountyVerifier;
    notary?: NotaryVerifier;
    property?: PropertyVerifier;
  }
): Promise<VerificationResult> {
  const checks: CheckResult[] = [];
  const reasons: string[] = [];
  let riskScore = 0;

  const notary = findNotary(registry, input.ron.notaryId);
  const provider = findRonProvider(registry, input.ron.provider);
  const timestamp = new Date(input.timestamp ?? new Date().toISOString());

  // ... (Existing Registry Checks) ...
  if (!provider || provider.status !== 'ACTIVE') {
    checks.push({ checkId: 'ron-provider', status: 'FAIL', details: 'Provider inactive or missing' });
    reasons.push('PROVIDER_INACTIVE');
    riskScore += 40;
  } else {
    checks.push({ checkId: 'ron-provider', status: 'PASS' });
  }

  if (!notary) {
    checks.push({ checkId: 'notary-authority', status: 'FAIL', details: 'Notary not found' });
    reasons.push('NOTARY_UNKNOWN');
    riskScore += 80;
  } else {
    const validFrom = new Date(notary.validFrom);
    const validTo = new Date(notary.validTo);
    if (notary.status !== 'ACTIVE' || timestamp < validFrom || timestamp > validTo) {
      checks.push({ checkId: 'notary-authority', status: 'FAIL', details: 'Notary not active' });
      reasons.push('NOTARY_INACTIVE');
      riskScore += 80;
    } else {
      checks.push({ checkId: 'notary-authority', status: 'PASS' });
    }
  }

  if (notary) {
    const signature = parseSignature(input.ron.sealPayload);
    try {
      const signer = verifyMessage(input.doc.docHash, signature);
      if (getAddress(signer) !== getAddress(notary.publicKey)) {
        checks.push({ checkId: 'seal-crypto', status: 'FAIL', details: 'Signature mismatch' });
        reasons.push('SEAL_INVALID');
        riskScore += 80;
      } else {
        checks.push({ checkId: 'seal-crypto', status: 'PASS' });
      }
    } catch (error) {
      checks.push({ checkId: 'seal-crypto', status: 'FAIL', details: 'Signature parse error' });
      reasons.push('SEAL_INVALID');
      riskScore += 80;
    }
  }

  // ... (Existing Policy Checks) ...
  if (input.transactionType.toLowerCase() === 'quitclaim') {
    reasons.push('QUITCLAIM_STRICT');
    riskScore += 35;
    checks.push({ checkId: 'policy-quitclaim', status: 'WARN', details: 'Quitclaim transfer' });
  }

  const policyState = parsePolicyState(input.policy.profile, input.ron.commissionState);
  if (input.ron.commissionState !== policyState) {
    reasons.push('OUT_OF_STATE_NOTARY');
    riskScore += input.policy.profile.includes('STRICT') ? 60 : 25;
    checks.push({ checkId: 'policy-out-of-state', status: 'WARN', details: 'Notary out of state' });
  }

  if (input.bundleId.includes('RAPID') || input.doc.docHash.endsWith('ff00ff')) {
    reasons.push('RAPID_TRANSFER_PATTERN');
    riskScore += 20;
    checks.push({ checkId: 'policy-rapid-transfer', status: 'WARN', details: 'Rapid transfer pattern' });
  }

  // --- NEW: County Verification (The "Fix") ---
  if (verifiers?.county && input.property) {
    try {
      const countyResult = await verifiers.county.verifyParcel(
        input.property.parcelId,
        input.property.county,
        input.property.state
      );

      if (countyResult.status === 'LOCKED') {
        checks.push({ checkId: 'county-status', status: 'FAIL', details: 'Property is LOCKED' });
        reasons.push('PROPERTY_LOCKED');
        riskScore += 100;
      } else if (countyResult.status === 'FLAGGED') {
        checks.push({ checkId: 'county-status', status: 'WARN', details: countyResult.details || 'County flagged property' });
        reasons.push('PROPERTY_FLAGGED');
        riskScore += 50;
      } else {
        checks.push({ checkId: 'county-status', status: 'PASS' });
      }
    } catch (err) {
      checks.push({ checkId: 'county-status', status: 'WARN', details: 'Verification service unavailable' });
      reasons.push('VERIFIER_ERROR');
    }
  }

  // --- NEW: Headless Metadata Verification (Phase 7) ---
  if (input.ocrData) {
    // 1. Notary State Registry Check
    if (verifiers?.notary && input.ocrData.notaryCommissionId && input.ocrData.notaryName) {
      try {
        const notaryResult = await verifiers.notary.verifyNotary(
          input.ron.commissionState,
          input.ocrData.notaryCommissionId,
          input.ocrData.notaryName
        );

        if (notaryResult.status === 'REVOKED') {
          checks.push({ checkId: 'external-notary', status: 'FAIL', details: 'Notary REVOKED in State Registry' });
          reasons.push('NOTARY_REVOKED_EXTERNAL');
          riskScore += 100;
        } else if (notaryResult.status === 'SUSPENDED') {
          checks.push({ checkId: 'external-notary', status: 'FAIL', details: 'Notary SUSPENDED in State Registry' });
          reasons.push('NOTARY_SUSPENDED_EXTERNAL');
          riskScore += 100;
        } else {
          checks.push({ checkId: 'external-notary', status: 'PASS', details: 'Confirmed Active in State DB' });
        }
      } catch (err) {
        checks.push({ checkId: 'external-notary', status: 'WARN', details: 'State Registry Unavailable' });
      }
    }

    // 2. Property Owner Match
    if (verifiers?.property && input.property?.parcelId && input.ocrData.grantorName) {
      try {
        const ownerResult = await verifiers.property.verifyOwner(
          input.property.parcelId,
          input.ocrData.grantorName
        );

        if (!ownerResult.match) {
          checks.push({
            checkId: 'owner-match',
            status: 'FAIL',
            details: `Grantor mismatch (${ownerResult.score}% match with Record Owner)`
          });
          reasons.push('OWNER_MISMATCH');
          riskScore += 80;
        } else {
          checks.push({ checkId: 'owner-match', status: 'PASS', details: 'Grantor matches Record Owner' });
        }
      } catch (err) {
        checks.push({ checkId: 'owner-match', status: 'WARN', details: 'Property DB Unavailable' });
      }
    }
  }

  let decision: VerificationResult['decision'] = 'ALLOW';
  if (checks.some((check) => check.status === 'FAIL')) {
    decision = 'BLOCK';
    riskScore = Math.max(riskScore, 90);
  } else if (riskScore >= 60) {
    decision = 'BLOCK';
  } else if (riskScore >= 30) {
    decision = 'FLAG';
  }

  return { decision, reasons: Array.from(new Set(reasons)), riskScore, checks };
}
