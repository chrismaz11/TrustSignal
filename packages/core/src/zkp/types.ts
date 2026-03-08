export type ZkpAttestationStatus = 'dev-only' | 'verifiable';
export type ZkpAttestationScheme = 'HALO2-DEV-v0' | 'HALO2-v1';
export type ZkpAttestationBackend = 'halo2-dev' | 'halo2';
export type ZkpDocumentWitnessMode = 'canonical-document-bytes-v1' | 'declared-doc-hash-v1';

export interface ZkpPublicInputs {
    policyHash: string;
    timestamp: string;
    inputsCommitment: string;
    conformance: boolean;
    declaredDocHash: string;
    documentDigest: string;
    documentCommitment: string;
    schemaVersion: string;
    documentWitnessMode: ZkpDocumentWitnessMode;
}

export interface ZkpProofArtifact {
    format: string;
    digest: string;
    encoding?: 'base64';
    proof?: string;
}

export interface ZKPAttestation {
    proofId: string;
    scheme: ZkpAttestationScheme;
    status: ZkpAttestationStatus;
    backend: ZkpAttestationBackend;
    circuitId?: string;
    publicInputs: ZkpPublicInputs;
    proofArtifact?: ZkpProofArtifact;
    verificationKeyId?: string;
    verifiedAt?: string;
}

export interface ComplianceInput {
    policyProfile: string;
    checksResult: boolean;
    inputsCommitment: string;
    docHash: string;
    canonicalDocumentBase64?: string;
}
