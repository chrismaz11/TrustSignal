import { Buffer } from 'node:buffer';
import { RiskSignal } from './types.js';

export interface PatternContext {
    notaryState?: string;
    policyProfile?: string;
}

/**
 * Checks for logical inconsistencies between issuer, jurisdiction, and policy.
 */
export async function checkPatternConsistency(pdfBuffer: Buffer, context: PatternContext): Promise<RiskSignal[]> {
    const signals: RiskSignal[] = [];

    // 1. Policy vs Notary State Mismatch
    // If policy implies a specific state (e.g., STANDARD_CA) but notary is from another state (e.g., NY),
    // this might be a risk depending on the rules.
    // We'll treat explicit mismatch as a flag.
    if (context.policyProfile && context.notaryState) {
        // Extract state from profile if it follows STANDARD_XX convention
        const match = context.policyProfile.match(/STANDARD_([A-Z]{2})/);
        if (match) {
            const policyState = match[1];
            if (policyState !== context.notaryState) {
                signals.push({
                    id: 'POLICY_JURISDICTION_MISMATCH',
                    description: `Policy profile ${context.policyProfile} expects ${policyState}, but notary commission is in ${context.notaryState}`,
                    severity: 'MEDIUM'
                });
            }
        }
    }

    // 2. Notary Block Structure (Mock)
    // We simulated checking the PDF content for the specific block in layout.ts with templateId,
    // Here we could check generics or other metadata-based patterns.
    // For now, we'll keep it simple: if notary state is known to require specific keywords, we check them.
    const pdfString = pdfBuffer.toString('latin1');

    if (context.notaryState === 'CA') {
        if (!pdfString.includes('penalty of perjury')) {
            signals.push({
                id: 'MISSING_MANDATORY_PHRASE',
                description: 'California documents must include "penalty of perjury" language',
                severity: 'HIGH'
            });
        }
    }

    return signals;
}
