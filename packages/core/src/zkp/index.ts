export * from './types.js';
import { ZKPAttestation, ComplianceInput } from './types.js';
import { keccak256, toUtf8Bytes } from 'ethers';

/**
 * Generates a mock Zero-Knowledge Proof of compliance.
 */
export async function generateComplianceProof(input: ComplianceInput): Promise<ZKPAttestation> {
    const proofId = `ZKP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const policyHash = keccak256(toUtf8Bytes(input.policyProfile));

    // We use public inputs + secret to generate the proof
    // proof = Hash(policyHash + checksResult + inputsCommitment + SECRET)
    const secret = 'SECRET_WITNESS_KEY';
    const mockProofData = keccak256(toUtf8Bytes(`${policyHash}:${input.checksResult}:${input.inputsCommitment}:${secret}`));

    return {
        proofId,
        scheme: 'GROTH16-MOCK-v1',
        publicInputs: {
            policyHash,
            timestamp: new Date().toISOString(),
            inputsCommitment: input.inputsCommitment,
            conformance: input.checksResult
        },
        proof: mockProofData
    };
}

export async function verifyComplianceProof(attestation: ZKPAttestation): Promise<boolean> {
    if (attestation.scheme !== 'GROTH16-MOCK-v1') return false;
    if (!attestation.proof) return false;

    const { policyHash, conformance, inputsCommitment } = attestation.publicInputs;

    // Re-compute proof to verify authenticity
    const secret = 'SECRET_WITNESS_KEY';
    const expectedProof = keccak256(toUtf8Bytes(`${policyHash}:${conformance}:${inputsCommitment}:${secret}`));

    if (attestation.proof !== expectedProof) {
        return false;
    }

    // Finally, the usual "business logic" of verification is that we expect conformance to be true
    return conformance === true;
}
