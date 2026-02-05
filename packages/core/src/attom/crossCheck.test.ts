import { describe, it, expect } from 'vitest';
import { attomCrossCheck, MockAttomClient } from './crossCheck.js';
import { DeedParsed, AttomLookupResult } from './types.js';

const baseDeed: DeedParsed = {
  jurisdiction: { state: 'IL', county: 'Cook' },
  pin: '12-34-567-890-0000',
  address: { line1: '123 Main St', city: 'Chicago', state: 'IL', zip: '60601' },
  legalDescriptionText: 'LOT 10 IN BLOCK 5 OF MAIN SUBDIVISION',
  grantors: ['SELLER ONE'],
  grantees: ['Buyer LLC'],
  executionDate: '2024-01-10',
  recording: { docNumber: 'R-2024-0001', recordingDate: '2024-01-12' },
  notary: { name: 'Jane Notary', commissionExpiration: '2025-01-01', state: 'IL' }
};

const attomCandidate: AttomLookupResult = {
  endpoint: 'parcel',
  property: {
    apn: '12345678900000',
    address: { line1: '123 MAIN ST', city: 'CHICAGO', state: 'IL', zip: '60601' },
    lot: { lot: '10', block: '5', subdivision: 'MAIN SUBDIVISION' },
    owners: ['Buyer Limited Liability Company']
  }
};

describe('attomCrossCheck', () => {
  it('passes when PIN and address match with high owner overlap', async () => {
    const client = new MockAttomClient({ parcel: [attomCandidate] });
    const report = await attomCrossCheck(baseDeed, client);

    expect(report.summary).toBe('PASS');
    expect(report.evidence.matchConfidence).toBeGreaterThan(0.8);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'pin-match', status: 'PASS' }),
        expect.objectContaining({ id: 'address-match', status: 'PASS' }),
        expect.objectContaining({ id: 'owner-match', status: 'PASS' })
      ])
    );
  });

  it('warns when only city/state match and no PIN', async () => {
    const deed = { ...baseDeed, pin: null };
    const client = new MockAttomClient({
      address: [
        {
          endpoint: 'address',
          property: {
            address: { line1: '999 OTHER ST', city: 'CHICAGO', state: 'IL', zip: '60699' }
          }
        }
      ]
    });

    const report = await attomCrossCheck(deed, client);
    expect(report.summary).toBe('WARN');
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'pin-match', status: 'SKIP' }),
        expect.objectContaining({ id: 'address-match', status: 'WARN' })
      ])
    );
  });

  it('skips when insufficient input', async () => {
    const deed = { ...baseDeed, pin: null, address: null };
    const client = new MockAttomClient({});
    const report = await attomCrossCheck(deed, client);
    expect(report.summary).toBe('SKIP');
    expect(report.checks[0].status).toBe('SKIP');
  });

  it('fails PIN mismatch when ATTOM returns conflicting APN', async () => {
    const client = new MockAttomClient({
      parcel: [
        {
          endpoint: 'parcel',
          property: {
            apn: '99999999999999',
            address: { line1: '123 MAIN ST', city: 'CHICAGO', state: 'IL', zip: '60601' }
          }
        }
      ]
    });
    const report = await attomCrossCheck(baseDeed, client);
    const pinCheck = report.checks.find((c) => c.id === 'pin-match');
    expect(pinCheck?.status).toBe('FAIL');
    expect(report.summary).toBe('FAIL');
  });
});
