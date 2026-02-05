import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { RiskEngine } from './index.js';

describe('RiskEngine', () => {
    const engine = new RiskEngine();

    it('returns LOW risk for clean document', async () => {
        const cleanPdf = Buffer.from('%PDF-1.4\n%Clean Document\n/CreationDate (D:20230101)\n/ModDate (D:20230101)\nCALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT\npenalty of perjury');
        const result = await engine.analyzeDocument(cleanPdf, {
            policyProfile: 'STANDARD_CA',
            notaryState: 'CA'
        });

        expect(result.score).toBe(0.0);
        expect(result.band).toBe('LOW');
        expect(result.signals).toHaveLength(0);
    });

    it('detects BAD_PRODUCER', async () => {
        const badPdf = Buffer.from('%PDF-1.4\n/Producer (SuspiciousPDFGenerator v1.0)\n');
        const result = await engine.analyzeDocument(badPdf);

        expect(result.signals.find(s => s.id === 'BAD_PRODUCER')).toBeDefined();
        expect(result.score).toBeGreaterThan(0);
    });

    it('detects INVALID_TIMESTAMPS', async () => {
        const badPdf = Buffer.from('%PDF-1.4\n/CreationDate (D:20200101)\n/ModDate (D:19900101)\n');
        const result = await engine.analyzeDocument(badPdf);

        expect(result.signals.find(s => s.id === 'INVALID_TIMESTAMPS')).toBeDefined();
    });

    it('detects TEMPLATE_MISMATCH for CA', async () => {
        const badPdf = Buffer.from('%PDF-1.4\nNo notary block here');
        const result = await engine.analyzeDocument(badPdf, {
            policyProfile: 'STANDARD_CA'
        });

        expect(result.signals.find(s => s.id === 'TEMPLATE_MISMATCH')).toBeDefined();
        expect(result.band).toBe('HIGH');
    });

    it('detects POLICY_JURISDICTION_MISMATCH', async () => {
        const pdf = Buffer.from('%PDF-1.4\nSome content');
        const result = await engine.analyzeDocument(pdf, {
            policyProfile: 'STANDARD_CA',
            notaryState: 'NY'
        });

        expect(result.signals.find(s => s.id === 'POLICY_JURISDICTION_MISMATCH')).toBeDefined();
    });

    it('detects MISSING_MANDATORY_PHRASE for CA', async () => {
        const pdf = Buffer.from('%PDF-1.4\nCALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT\n(missing words)');
        const result = await engine.analyzeDocument(pdf, {
            policyProfile: 'STANDARD_CA',
            notaryState: 'CA'
        });

        // We expect both 'MISSING_MANDATORY_PHRASE' (from pattern check) 
        // AND possibly 'TEMPLATE_MISMATCH' if layout check fails (but here layout check simulates searching for ACKNOWLEDGMENT, which is present)

        expect(result.signals.find(s => s.id === 'MISSING_MANDATORY_PHRASE')).toBeDefined();
    });
});
