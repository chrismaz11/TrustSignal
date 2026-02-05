import { OCRData } from './types.js';

export type NotaryStatus = 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN';

export interface NotaryVerifier {
    verifyNotary(state: string, commissionId: string, name: string): Promise<{
        status: NotaryStatus;
        details?: string;
    }>;
}

export interface PropertyVerifier {
    verifyOwner(parcelId: string, grantorName: string): Promise<{ match: boolean; score: number; recordOwner?: string }>;
}

// --- HELPER: Fuzzy Matching ---
function levenshteinDistance(a: string, b: string): number {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) == a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    const distance = levenshteinDistance(s1, s2);
    return Math.round((1 - distance / maxLen) * 100);
}

// --- REAL IMPLEMENTATION: Notary Verifier ---
export class RealNotaryVerifier implements NotaryVerifier {
    private readonly apiKey: string;
    private readonly baseUrl: string = 'https://api.notary-check.com/v1'; // Example Aggregator

    constructor() {
        this.apiKey = process.env.NOTARY_API_KEY || '';
        if (!this.apiKey) console.warn('[RealNotaryVerifier] No API Key found. Validation will fail.');
    }

    async verifyNotary(state: string, commissionId: string, name: string): Promise<{ status: NotaryStatus; details?: string }> {
        if (!this.apiKey) return { status: 'UNKNOWN', details: 'Missing Server Configuration (API Key)' };

        try {
            const response = await fetch(`${this.baseUrl}/check`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({ state, commissionId, name })
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

            const data = await response.json();
            // Expected: { status: 'ACTIVE', ... }
            return {
                status: data.status as NotaryStatus,
                details: data.details || `Verified via ${state} Registry`
            };

        } catch (error) {
            console.error('[NotaryVerifier] External API Verification Failed:', error);
            // Fallback to "UNKNOWN" so we don't block valid users on network error, but flag it
            return { status: 'UNKNOWN', details: 'External Registry Unavailable' };
        }
    }
}

// --- REAL IMPLEMENTATION: Property Verifier ---
export class RealPropertyVerifier implements PropertyVerifier {
    private readonly apiKey: string;
    private readonly baseUrl: string = 'https://apis.estated.com/v4/property';

    constructor() {
        this.apiKey = process.env.PROPERTY_API_KEY || '';
        if (!this.apiKey) console.warn('[RealPropertyVerifier] No API Key found.');
    }

    async verifyOwner(parcelId: string, grantorName: string): Promise<{ match: boolean; score: number; recordOwner?: string }> {
        if (!this.apiKey) return { match: false, score: 0, recordOwner: 'CONFIGURATION_ERROR' };

        try {
            // Estated typically uses address, but we loosely map parcelId for this implementation
            // Real implementation would parse address components or use FIPS+APN
            const url = new URL(this.baseUrl);
            url.searchParams.append('token', this.apiKey);
            url.searchParams.append('id', parcelId); // Assuming we look up by APN/ID

            const response = await fetch(url.toString());
            if (!response.ok) throw new Error(`Estated API Error: ${response.status}`);

            const data = await response.json();
            const recordOwner = data.data?.owner?.name || 'UNKNOWN';

            // Fuzzy Match
            const score = calculateSimilarity(grantorName, recordOwner);

            console.log(`[PropertyVerifier] Match: ${grantorName} vs ${recordOwner} = ${score}%`);

            return {
                match: score >= 80, // Threshold
                score,
                recordOwner
            };

        } catch (error) {
            console.error('[PropertyVerifier] API Lookup Failed:', error);
            return { match: false, score: 0, recordOwner: 'LOOKUP_FAILED' };
        }
    }
}
