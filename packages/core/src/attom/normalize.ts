import { createHash } from 'node:crypto';
import { DeedParsed, AttomProperty } from './types.js';

export function normalizePin(pin: string | null | undefined): string | null {
  if (!pin) return null;
  return pin.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

export function normalizeAddress(address: NonNullable<DeedParsed['address']>) {
  const clean = (s: string | null | undefined) => (s || '').trim().toUpperCase().replace(/\s+/g, ' ');
  return {
    line1: clean(address.line1),
    city: clean(address.city),
    state: clean(address.state),
    zip: (address.zip || '').trim().slice(0, 5)
  };
}

export function addressSimilarity(
  deedAddr: NonNullable<DeedParsed['address']>,
  attomAddr: NonNullable<AttomProperty['address']>
): { score: number; level: 'none' | 'city_state' | 'street' | 'street_zip' } {
  const d = normalizeAddress(deedAddr);
  const a = normalizeAddress({
    line1: attomAddr.line1 || '',
    city: attomAddr.city || '',
    state: attomAddr.state || '',
    zip: attomAddr.zip || ''
  });

  const streetMatch = d.line1 === a.line1;
  const cityStateMatch = d.city === a.city && d.state === a.state;
  const zipMatch = d.zip && a.zip && d.zip === a.zip;

  if (streetMatch && zipMatch) return { score: 1, level: 'street_zip' };
  if (streetMatch && cityStateMatch) return { score: 0.75, level: 'street' };
  if (cityStateMatch) return { score: 0.5, level: 'city_state' };
  return { score: 0, level: 'none' };
}

const COMPANY_SUFFIXES = /\b(LLC|L\.L\.C\.|INC|INCORPORATED|CO|COMPANY|LP|L\.P\.|LLP|L\.L\.P\.|TRUST|ET\s*AL)\b/gi;

export function normalizeName(name: string) {
  const upper = name.toUpperCase();
  const llcCollapsed = upper.replace(/LIMITED LIABILITY COMPANY|LTD LIABILITY COMPANY/g, 'LLC');
  const stripped = llcCollapsed.replace(COMPANY_SUFFIXES, '').replace(/[^A-Z0-9\s]/gi, ' ');
  return stripped.trim().replace(/\s+/g, ' ');
}

export function tokenOverlap(a: string[], b: string[]): number {
  if (!a.length || !b.length) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((t) => setB.has(t)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

export function nameOverlapScore(deedNames: string[], attomNames: string[]): number {
  const normDeed = deedNames.map(normalizeName).filter(Boolean);
  const normAttom = attomNames.map(normalizeName).filter(Boolean);
  if (!normDeed.length || !normAttom.length) return 0;
  let best = 0;
  for (const d of normDeed) {
    const dTokens = d.split(' ').filter(Boolean);
    for (const a of normAttom) {
      const aTokens = a.split(' ').filter(Boolean);
      best = Math.max(best, tokenOverlap(dTokens, aTokens));
    }
  }
  return best;
}

export function canonicalDeedHash(deed: DeedParsed): string {
  const pin = normalizePin(deed.pin) || '';
  const legal = (deed.legalDescriptionText || '').trim();
  const docNumber = deed.recording.docNumber || '';
  const recDate = deed.recording.recordingDate || '';
  const canonical = `${pin}|${legal}|${docNumber}|${recDate}`;
  return createHash('sha256').update(canonical).digest('hex');
}

export function redact(input: string | null | undefined): string | null {
  if (!input) return null;
  const hash = createHash('sha256').update(input).digest('hex').slice(0, 10);
  return `hash:${hash}`;
}
