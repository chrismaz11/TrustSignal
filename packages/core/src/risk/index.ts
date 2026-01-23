import { Buffer } from 'node:buffer';
import { DocumentRisk, RiskEngineOptions, RiskSignal, RiskBand } from './types.js';
import { checkPdfForensics } from './forensics.js';
import { checkLayoutConsistency } from './layout.js';
import { checkPatternConsistency } from './patterns.js';

export * from './types.js';

export class RiskEngine {
    constructor() { }

    async analyzeDocument(
        pdfBuffer: Buffer,
        context: {
            policyProfile?: string;
            notaryState?: string;
        } = {},
        options: RiskEngineOptions = { checkForensics: true, checkLayout: true }
    ): Promise<DocumentRisk> {
        const allSignals: RiskSignal[] = [];

        // 1. Forensics
        if (options.checkForensics) {
            const forensicsSignals = await checkPdfForensics(pdfBuffer);
            allSignals.push(...forensicsSignals);
        }

        // 2. Layout & Template
        if (options.checkLayout) {
            const layoutSignals = await checkLayoutConsistency(pdfBuffer, {
                templateId: context.policyProfile
            });
            allSignals.push(...layoutSignals);
        }

        // 3. Issuer/Jurisdiction Pattern Checks (Simple Logic)
        const patternSignals = await checkPatternConsistency(pdfBuffer, context);
        allSignals.push(...patternSignals);

        return this.calculateScore(allSignals);
    }

    private calculateScore(signals: RiskSignal[]): DocumentRisk {
        if (signals.length === 0) {
            return { score: 0.0, band: 'LOW', signals: [] };
        }

        let rawScore = 0;
        for (const s of signals) {
            switch (s.severity) {
                case 'HIGH': rawScore += 0.8; break;
                case 'MEDIUM': rawScore += 0.4; break;
                case 'LOW': rawScore += 0.1; break;
            }
        }

        // Cap at 1.0
        const score = Math.min(rawScore, 1.0);

        let band: RiskBand = 'LOW';
        if (score > 0.7) band = 'HIGH';
        else if (score > 0.3) band = 'MEDIUM';

        return { score, band, signals };
    }
}
