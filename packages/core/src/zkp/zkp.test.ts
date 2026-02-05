import { describe, expect, it } from 'vitest';
import { generateComplianceProof, verifyComplianceProof } from './index.js';

describe('ZKP Compliance', () => {
    it('generates a valid proof for passing checks', async () => {
        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: true,
            inputsCommitment: '0x123...'
        };

        const attestation = await generateComplianceProof(input);
        expect(attestation.scheme).toBe('GROTH16-MOCK-v1');
        expect(attestation.publicInputs.conformance).toBe(true);
        expect(attestation.proof).toBeDefined();

        const isValid = await verifyComplianceProof(attestation);
        expect(isValid).toBe(true);
    });

    it('verifies non-conforming result correctly (fails policy but proof is valid for "false")', async () => {
        // The ZKP proves that the inputs yielded 'false'.
        // The verification function here checks if the attestation ITSELF is valid crypto-wise,
        // but usually we want to verify "Compliance" means true.
        // My implementation of verifyComplianceProof checks `conformance === true`. 

        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: false,
            inputsCommitment: '0x123...'
        };

        const attestation = await generateComplianceProof(input);
        expect(attestation.publicInputs.conformance).toBe(false);

        const isValid = await verifyComplianceProof(attestation);
        expect(isValid).toBe(false); // Because our helper checks for conformance=true
    });
});
