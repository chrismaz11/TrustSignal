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

export class MockStateNotaryVerifier {
    async verifyNotary(state: string, commissionId: string, name: string): Promise<{ status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN'; details?: string }> {
        if (commissionId === '999999') {
            return { status: 'REVOKED' };
        }
        return { status: 'ACTIVE' };
    }
}

export class MockPropertyVerifier {
    async verifyOwner(parcelId: string, grantorName: string): Promise<{ match: boolean; score: number; recordOwner?: string }> {
        let recordOwner = 'Unknown';
        if (parcelId === 'PARCEL-12345') {
            recordOwner = 'John Doe';
        }

        if (recordOwner === 'John Doe' && grantorName !== 'John Doe') {
            return { match: false, score: 0, recordOwner };
        }

        // Default pass for other cases to keep it simple
        return { match: true, score: 95, recordOwner: grantorName };
    }
}
