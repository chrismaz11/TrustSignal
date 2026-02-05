import { DeedParsed, VerificationReport, ReportCheck, AttomClient, AttomLookupResult } from './types.js';
import {
  normalizePin,
  addressSimilarity,
  nameOverlapScore,
  canonicalDeedHash,
  redact
} from './normalize.js';

type ConfidenceContrib = {
  pin: number;
  address: number;
  owner: number;
  legal: number;
};

function pickBestCandidate(
  deed: DeedParsed,
  candidates: AttomLookupResult[]
): AttomLookupResult | null {
  if (!candidates.length) return null;
  const targetPin = normalizePin(deed.pin);

  const scored = candidates.map((c) => {
    const candPin = normalizePin(c.property.apn || c.property.altId);
    const pinExact = targetPin && candPin && targetPin === candPin ? 1 : 0;

    let addressScore = 0;
    if (deed.address && c.property.address) {
      addressScore = addressSimilarity(deed.address, c.property.address).score;
    }
    return { c, pinExact, addressScore };
  });

  scored.sort((a, b) => {
    if (b.pinExact !== a.pinExact) return b.pinExact - a.pinExact;
    return b.addressScore - a.addressScore;
  });

  return scored[0].c;
}

function buildCheck(partial: Partial<ReportCheck>): ReportCheck {
  return {
    id: partial.id || 'unknown',
    status: partial.status || 'WARN',
    message: partial.message || '',
    deedValue: partial.deedValue,
    attomValue: partial.attomValue,
    evidence: partial.evidence
  };
}

function calcConfidence(weights: ConfidenceContrib): number {
  const total = weights.pin + weights.address + weights.owner + weights.legal;
  return Math.min(1, Math.max(0, total));
}

export async function attomCrossCheck(
  deed: DeedParsed,
  client: AttomClient,
  now: Date = new Date()
): Promise<VerificationReport> {
  const checks: ReportCheck[] = [];
  const canonicalHash = canonicalDeedHash(deed);
  let endpoint: 'parcel' | 'address' | undefined;

  if (!deed.pin && !deed.address) {
    return {
      summary: 'SKIP',
      checks: [
        buildCheck({
          id: 'input',
          status: 'SKIP',
          message: 'No PIN or address provided; cannot query ATTOM'
        })
      ],
      evidence: {
        endpointUsed: undefined,
        matchConfidence: 0,
        timestamp: now.toISOString(),
        reason: 'INSUFFICIENT_INPUT',
        canonicalHash
      }
    };
  }

  let results: AttomLookupResult[] = [];
  if (deed.pin) {
    endpoint = 'parcel';
    results = await client.getByParcel(deed.pin);
  }
  if ((!results || results.length === 0) && deed.address) {
    endpoint = 'address';
    results = await client.getByAddress(deed.address);
  }

  const candidate = pickBestCandidate(deed, results);

  if (!candidate) {
    return {
      summary: 'WARN',
      checks: [
        buildCheck({
          id: 'attom-availability',
          status: 'WARN',
          message: 'ATTOM did not return a match',
          deedValue: normalizePin(deed.pin) || deed.address?.line1 || null
        })
      ],
      evidence: {
        endpointUsed: endpoint,
        matchConfidence: 0,
        timestamp: now.toISOString(),
        reason: 'ATTOM_NO_MATCH',
        canonicalHash
      }
    };
  }

  const { property } = candidate;
  const weights: ConfidenceContrib = { pin: 0, address: 0, owner: 0, legal: 0 };

  // A) PIN/APN match
  if (deed.pin && (property.apn || property.altId)) {
    const deedPin = normalizePin(deed.pin);
    const attomPin = normalizePin(property.apn || property.altId);
    if (deedPin && attomPin && deedPin === attomPin) {
      weights.pin = 0.55;
      checks.push(
        buildCheck({
          id: 'pin-match',
          status: 'PASS',
          message: 'PIN/APN matches',
          deedValue: deedPin,
          attomValue: attomPin
        })
      );
    } else if (deedPin && attomPin && attomPin.startsWith(deedPin.slice(0, 6))) {
      weights.pin = 0.25;
      checks.push(
        buildCheck({
          id: 'pin-match',
          status: 'WARN',
          message: 'Partial PIN/APN match',
          deedValue: deedPin,
          attomValue: attomPin
        })
      );
    } else {
      checks.push(
        buildCheck({
          id: 'pin-match',
          status: 'FAIL',
          message: 'PIN/APN mismatch',
          deedValue: deedPin,
          attomValue: attomPin
        })
      );
    }
  } else {
    checks.push(
      buildCheck({
        id: 'pin-match',
        status: 'SKIP',
        message: 'No PIN/APN provided in deed or ATTOM response'
      })
    );
  }

  // B) Address match
  if (deed.address && property.address?.line1) {
    const addrScore = addressSimilarity(deed.address, property.address);
    if (addrScore.level === 'street_zip') {
      weights.address = 0.25;
      checks.push(buildCheck({ id: 'address-match', status: 'PASS', message: 'Street + ZIP match' }));
    } else if (addrScore.level === 'street') {
      weights.address = 0.2;
      checks.push(buildCheck({ id: 'address-match', status: 'WARN', message: 'Street matches; ZIP missing/different' }));
    } else if (addrScore.level === 'city_state') {
      weights.address = 0.1;
      checks.push(buildCheck({ id: 'address-match', status: 'WARN', message: 'Only city/state match' }));
    } else {
      checks.push(buildCheck({ id: 'address-match', status: 'FAIL', message: 'Address mismatch' }));
    }
  } else {
    checks.push(buildCheck({ id: 'address-match', status: 'SKIP', message: 'Address not available for comparison' }));
  }

  // C) Owner match (privacy-safe)
  if (property.owners && property.owners.length && deed.grantees.length) {
    const overlap = nameOverlapScore(deed.grantees, property.owners);
    if (overlap >= 0.8) {
      weights.owner = 0.15;
      checks.push(
        buildCheck({
          id: 'owner-match',
          status: 'PASS',
          message: 'Owner overlap high',
          evidence: { score: overlap }
        })
      );
    } else if (overlap >= 0.5) {
      weights.owner = 0.08;
      checks.push(buildCheck({ id: 'owner-match', status: 'WARN', message: 'Owner overlap moderate', evidence: { score: overlap } }));
    } else {
      checks.push(buildCheck({ id: 'owner-match', status: 'FAIL', message: 'Owner overlap low', evidence: { score: overlap } }));
    }
  } else {
    checks.push(buildCheck({ id: 'owner-match', status: 'SKIP', message: 'Owner data unavailable; skipped for privacy' }));
  }

  // D) Legal description token check
  if (property.lot && deed.legalDescriptionText) {
    const legal = deed.legalDescriptionText.toUpperCase();
    const tokens = [property.lot.lot, property.lot.block, property.lot.tract, property.lot.subdivision]
      .filter(Boolean)
      .map((t) => t!.toString().toUpperCase());
    const missing = tokens.filter((t) => !legal.includes(t));
    if (tokens.length && missing.length === 0) {
      weights.legal = 0.05;
      checks.push(buildCheck({ id: 'legal-description', status: 'PASS', message: 'Legal description tokens present' }));
    } else if (tokens.length) {
      checks.push(
        buildCheck({
          id: 'legal-description',
          status: 'WARN',
          message: 'Some legal tokens not found in deed description',
          evidence: { missing }
        })
      );
    } else {
      checks.push(buildCheck({ id: 'legal-description', status: 'SKIP', message: 'No legal tokens from ATTOM' }));
    }
  } else {
    checks.push(buildCheck({ id: 'legal-description', status: 'SKIP', message: 'Legal description comparison not available' }));
  }

  // E) Temporal sanity
  if (deed.executionDate && deed.recording.recordingDate) {
    const exec = new Date(deed.executionDate);
    const rec = new Date(deed.recording.recordingDate);
    if (exec.getTime() > rec.getTime()) {
      checks.push(buildCheck({ id: 'temporal', status: 'WARN', message: 'Execution date is after recording date' }));
    }
    if (rec.getTime() > now.getTime()) {
      checks.push(buildCheck({ id: 'temporal', status: 'WARN', message: 'Recording date is in the future' }));
    }
  }

  // F) Notary expiration sanity
  if (deed.notary?.commissionExpiration && deed.executionDate) {
    const exp = new Date(deed.notary.commissionExpiration);
    const exec = new Date(deed.executionDate);
    if (exp.getTime() < exec.getTime()) {
      checks.push(buildCheck({ id: 'notary-expiration', status: 'WARN', message: 'Notary commission expired before execution' }));
    }
  }

  // Compute summary
  const hasFail = checks.some((c) => c.status === 'FAIL');
  const hasWarn = checks.some((c) => c.status === 'WARN');
  const summary: VerificationReport['summary'] = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'PASS';

  const confidence = calcConfidence(weights);

  return {
    summary,
    checks,
    evidence: {
      attomRequestId: candidate.requestId,
      endpointUsed: candidate.endpoint,
      matchConfidence: confidence,
      timestamp: now.toISOString(),
      reason: undefined,
      canonicalHash
    }
  };
}

// Convenience mock client for tests/offline use
export class MockAttomClient implements AttomClient {
  constructor(private responses: { parcel?: AttomLookupResult[]; address?: AttomLookupResult[] }) {}
  async getByParcel(pin: string): Promise<AttomLookupResult[]> {
    return this.responses.parcel || [];
  }
  async getByAddress(): Promise<AttomLookupResult[]> {
    return this.responses.address || [];
  }
}
