
export interface ZKPAttestation {
    proofId: string;
    scheme: 'GROTH16-MOCK-v1';
    publicInputs: {
        policyHash: string;
        timestamp: string;
        inputsCommitment: string;
        // Specifically ensuring NotaryID/County codes are NOT here, only the RESULT.
        conformance: boolean;
    };
    proof: string; // Base64 encoded proof data
}

export interface ComplianceInput {
    policyProfile: string;
    checksResult: boolean;
    inputsCommitment: string;
}
