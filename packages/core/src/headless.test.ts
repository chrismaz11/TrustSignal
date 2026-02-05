import { describe, it, expect } from 'vitest';
import { verifyBundle } from './verification.js';
import { MockStateNotaryVerifier, MockPropertyVerifier } from './mocks.js';
import { BundleInput, TrustRegistry, OCRData } from './types.js';
import { generateTrustRegistry, generateBundle } from './synthetic.js';

describe('Headless Verification Logic', () => {
    it('should flag a revoked notary found in external registry', async () => {
        const registry = generateTrustRegistry();
        const bundle = generateBundle(registry);

        // Inject OCR Data pointing to a "REVOKED" notary in our mock
        bundle.ocrData = {
            notaryName: 'Bad Actor',
            notaryCommissionId: '999999', // Matches REVOKED in MockStateNotaryVerifier
            propertyAddress: '123 Fake St',
            grantorName: 'John Doe'
        };

        // Use matching commission state
        bundle.ron.commissionState = 'TX';

        const verifiers = {
            notary: new MockStateNotaryVerifier()
        };

        const result = await verifyBundle(bundle, registry, verifiers);

        expect(result.checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    checkId: 'external-notary',
                    status: 'FAIL',
                    details: 'Notary REVOKED in State Registry'
                })
            ])
        );
        expect(result.reasons).toContain('NOTARY_REVOKED_EXTERNAL');
    });

    it('should flag a property owner mismatch', async () => {
        const registry = generateTrustRegistry();
        const bundle = generateBundle(registry);

        // Inject OCR Data with a mismatching Grantor
        bundle.property = {
            parcelId: 'PARCEL-12345', // Owned by 'John Doe' in MockPropertyVerifier
            county: 'Travis',
            state: 'TX'
        };
        // Grantor is "Alice scammer" vs Owner "John Doe"
        bundle.ocrData = {
            grantorName: 'Alice Scammer'
        };

        const verifiers = {
            property: new MockPropertyVerifier()
        };

        const result = await verifyBundle(bundle, registry, verifiers);

        expect(result.checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    checkId: 'owner-match',
                    status: 'FAIL',
                    details: expect.stringContaining('Grantor mismatch')
                })
            ])
        );
        expect(result.reasons).toContain('OWNER_MISMATCH');
    });

    it('should pass given valid OCR data', async () => {
        const registry = generateTrustRegistry();
        const bundle = generateBundle(registry);

        bundle.property = {
            parcelId: 'PARCEL-12345',
            county: 'Travis',
            state: 'TX'
        };

        bundle.ocrData = {
            notaryCommissionId: '123456', // ACTIVE in Mock
            notaryName: 'Good Notary',
            grantorName: 'John Doe'       // Matches Owner of PARCEL-12345
        };
        bundle.ron.commissionState = 'TX';

        const verifiers = {
            notary: new MockStateNotaryVerifier(),
            property: new MockPropertyVerifier()
        };

        const result = await verifyBundle(bundle, registry, verifiers);

        expect(result.checks).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ checkId: 'external-notary', status: 'PASS' }),
                expect.objectContaining({ checkId: 'owner-match', status: 'PASS' })
            ])
        );
    });
});
