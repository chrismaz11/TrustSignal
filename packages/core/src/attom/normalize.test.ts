import { describe, expect, it } from 'vitest';

import {
  addressSimilarity,
  canonicalDeedHash,
  nameOverlapScore,
  normalizeAddress,
  normalizeName,
  normalizePin,
  redact,
  tokenOverlap
} from './normalize.js';
import type { DeedParsed } from './types.js';

describe('normalizePin', () => {
  it('returns null for null input', () => {
    expect(normalizePin(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizePin(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(normalizePin('')).toBeNull();
  });

  it('strips non-alphanumeric characters and uppercases', () => {
    expect(normalizePin('12-34-567-890-0000')).toBe('12345678900000');
  });

  it('preserves alphanumeric characters', () => {
    expect(normalizePin('ABC123')).toBe('ABC123');
  });

  it('handles already normalized PIN', () => {
    expect(normalizePin('ABC123DEF')).toBe('ABC123DEF');
  });

  it('converts lowercase to uppercase', () => {
    expect(normalizePin('abc123')).toBe('ABC123');
  });
});

describe('normalizeAddress', () => {
  const base = { line1: '  123 main st  ', city: 'chicago', state: 'il', zip: '60601' };

  it('uppercases and trims line1', () => {
    const result = normalizeAddress(base);
    expect(result.line1).toBe('123 MAIN ST');
  });

  it('uppercases city', () => {
    const result = normalizeAddress(base);
    expect(result.city).toBe('CHICAGO');
  });

  it('uppercases state', () => {
    const result = normalizeAddress(base);
    expect(result.state).toBe('IL');
  });

  it('trims zip to 5 characters', () => {
    const result = normalizeAddress({ ...base, zip: '60601-1234' });
    expect(result.zip).toBe('60601');
  });

  it('handles null-like values with empty string fallback', () => {
    const result = normalizeAddress({ line1: null as unknown as string, city: undefined as unknown as string, state: 'TX', zip: '75001' });
    expect(result.line1).toBe('');
    expect(result.city).toBe('');
  });

  it('handles zip when null-like via OR fallback', () => {
    const result = normalizeAddress({ line1: '123 St', city: 'City', state: 'CA', zip: null as unknown as string });
    expect(result.zip).toBe('');
  });


describe('addressSimilarity', () => {
  const deedAddr = { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' };
  const attomAddr = { line1: '123 MAIN ST', city: 'CHICAGO', state: 'IL', zip: '60601' };

  it('returns street_zip level and score 1 for full match', () => {
    const result = addressSimilarity(deedAddr, attomAddr);
    expect(result.level).toBe('street_zip');
    expect(result.score).toBe(1);
  });

  it('returns street level when street matches but zip differs', () => {
    const result = addressSimilarity(deedAddr, { ...attomAddr, zip: '60699' });
    expect(result.level).toBe('street');
    expect(result.score).toBe(0.75);
  });

  it('returns city_state level when only city and state match', () => {
    const result = addressSimilarity(deedAddr, { ...attomAddr, line1: '999 Other St', zip: '60699' });
    expect(result.level).toBe('city_state');
    expect(result.score).toBe(0.5);
  });

  it('handles undefined attomAddr properties with empty string fallback', () => {
    const result = addressSimilarity(
      { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
      { line1: undefined as unknown as string, city: undefined as unknown as string, state: undefined as unknown as string, zip: undefined as unknown as string }
    );
    expect(result.level).toBe('none');
    expect(result.score).toBe(0);
  });

    const result = addressSimilarity(
      deedAddr,
      { line1: '999 Other Rd', city: 'Springfield', state: 'MO', zip: '65000' }
    );
    expect(result.level).toBe('none');
    expect(result.score).toBe(0);
  });
});

describe('normalizeName', () => {
  it('removes LLC suffix', () => {
    expect(normalizeName('ACME LLC')).toBe('ACME');
  });

  it('expands Limited Liability Company to LLC then removes it', () => {
    expect(normalizeName('ACME Limited Liability Company')).toBe('ACME');
  });

  it('removes INC suffix', () => {
    expect(normalizeName('Big Corp Inc')).toBe('BIG CORP');
  });

  it('removes TRUST suffix', () => {
    expect(normalizeName('Smith Family Trust')).toBe('SMITH FAMILY');
  });

  it('removes ET AL suffix', () => {
    expect(normalizeName('John Doe Et Al')).toBe('JOHN DOE');
  });

  it('uppercases the result', () => {
    expect(normalizeName('john doe')).toBe('JOHN DOE');
  });

  it('strips non-alphanumeric characters (except spaces)', () => {
    expect(normalizeName('Smith & Jones')).toBe('SMITH JONES');
  });
});

describe('tokenOverlap', () => {
  it('returns 0 for empty arrays', () => {
    expect(tokenOverlap([], [])).toBe(0);
  });

  it('returns 0 when one array is empty', () => {
    expect(tokenOverlap(['a', 'b'], [])).toBe(0);
  });

  it('returns 1.0 for identical token sets', () => {
    expect(tokenOverlap(['A', 'B'], ['A', 'B'])).toBe(1);
  });

  it('returns 0 for completely disjoint sets', () => {
    expect(tokenOverlap(['A', 'B'], ['C', 'D'])).toBe(0);
  });

  it('computes partial overlap correctly', () => {
    // intersection = {A}, union = {A, B, C}
    const result = tokenOverlap(['A', 'B'], ['A', 'C']);
    expect(result).toBeCloseTo(1 / 3);
  });
});

describe('nameOverlapScore', () => {
  it('returns 0 for empty deed names', () => {
    expect(nameOverlapScore([], ['BUYER LLC'])).toBe(0);
  });

  it('returns 0 for empty attom names', () => {
    expect(nameOverlapScore(['BUYER LLC'], [])).toBe(0);
  });

  it('returns high score for matching names after normalization', () => {
    const score = nameOverlapScore(['Buyer Limited Liability Company'], ['BUYER LLC']);
    expect(score).toBeGreaterThan(0.8);
  });

  it('returns 0 for completely different names', () => {
    const score = nameOverlapScore(['Smith Family Trust'], ['Jones Inc']);
    expect(score).toBe(0);
  });
});

describe('canonicalDeedHash', () => {
  const baseDeed: DeedParsed = {
    jurisdiction: { state: 'IL', county: 'Cook' },
    pin: '12-34-567',
    address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
    legalDescriptionText: 'LOT 1',
    grantors: ['Seller'],
    grantees: ['Buyer'],
    executionDate: '2024-01-10',
    recording: { docNumber: 'DOC-001', recordingDate: '2024-01-12' },
    notary: { name: 'Jane Doe', commissionExpiration: '2025-01-01', state: 'IL' }
  };

  it('returns a 64-character hex string', () => {
    const hash = canonicalDeedHash(baseDeed);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns same hash for identical deeds', () => {
    expect(canonicalDeedHash(baseDeed)).toBe(canonicalDeedHash({ ...baseDeed }));
  });

  it('returns different hash when PIN changes', () => {
    const h1 = canonicalDeedHash(baseDeed);
    const h2 = canonicalDeedHash({ ...baseDeed, pin: '99-99-999' });
    expect(h1).not.toBe(h2);
  });

  it('handles null PIN gracefully', () => {
    const hash = canonicalDeedHash({ ...baseDeed, pin: null });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles null recording fields with empty string fallback', () => {
    const deed: DeedParsed = {
      ...baseDeed,
      recording: {
        docNumber: null as unknown as string,
        recordingDate: null as unknown as string
      }
    };
    const hash = canonicalDeedHash(deed);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Verify it's different from full-data hash
    expect(hash).not.toBe(canonicalDeedHash(baseDeed));
  });

  it('handles undefined legalDescriptionText gracefully', () => {
    const hash = canonicalDeedHash({ ...baseDeed, legalDescriptionText: undefined });
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('redact', () => {
  it('returns null for null input', () => {
    expect(redact(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(redact(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(redact('')).toBeNull();
  });

  it('returns a hash: prefixed string for non-empty input', () => {
    const result = redact('sensitive-value');
    expect(result).toMatch(/^hash:[0-9a-f]{10}$/);
  });

  it('produces consistent hash for the same input', () => {
    expect(redact('abc')).toBe(redact('abc'));
  });

  it('produces different hash for different inputs', () => {
    expect(redact('abc')).not.toBe(redact('xyz'));
  });
});
