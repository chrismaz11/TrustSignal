import { CountyCheckResult, CountyVerifier } from './types.js';

export class MockCountyVerifier implements CountyVerifier {
    // Simulates a database of "Bad" parcels
    private readonly flaggedParcels = new Map<string, CountyCheckResult>([
        ['SCAM-101', { status: 'FLAGGED', details: 'Parcel associated with known deed fraud ring' }],
        ['LOCKED-999', { status: 'LOCKED', details: 'Administrative lock by County Recorder' }],
        ['DISPUTE-500', { status: 'FLAGGED', details: 'Active quiet title action pending' }]
    ]);

    async verifyParcel(parcelId: string, county: string, state: string): Promise<CountyCheckResult> {
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Check specific flagged IDs
        if (this.flaggedParcels.has(parcelId)) {
            return this.flaggedParcels.get(parcelId)!;
        }

        // Default to clean
        return { status: 'CLEAN' };
    }
}
