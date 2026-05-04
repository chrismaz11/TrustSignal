export * from './types.js';
import { ChildProcessWithoutNullStreams, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';

import { keccak256, toUtf8Bytes } from 'ethers';

import {
    ZKPAttestation,
    ComplianceInput,
    ZkpPublicInputs,
    ZkpDocumentWitnessMode
} from './types.js';

type ZkpBackendMode = 'dev-only' | 'external';
type PrivateWitness = {
    canonicalDocumentBase64: string;
};

const DOCUMENT_CIRCUIT_ID = 'document-sha256-v1';
const DOCUMENT_SCHEMA_VERSION = 'trustsignal.document_sha256.v1';

type ExternalProverRequest =
    | {
        action: 'prove';
        publicInputs: ZkpPublicInputs;
        privateWitness: PrivateWitness;
      }
    | {
        action: 'verify';
        attestation: ZKPAttestation;
      };

type ExternalProverResponse =
    | {
        attestation: ZKPAttestation;
      }
    | {
        verified: boolean;
      };

type PendingExternalRequest = {
    resolve: (value: ExternalProverResponse) => void;
    reject: (error: Error) => void;
};

type ExternalProcess = {
    child: ChildProcessWithoutNullStreams;
    pending: Map<string, PendingExternalRequest>;
    stdoutBuffer: string;
    stderrBuffer: string;
};

const externalProcessCache = new Map<string, ExternalProcess>();

function sha256Hex(input: Buffer | string): string {
    return `0x${createHash('sha256').update(input).digest('hex')}`;
}

function decodeDigestBytes(value: string): Buffer {
    const normalized = value.startsWith('0x') ? value.slice(2) : value;
    if (!/^[0-9a-f]{64}$/i.test(normalized)) {
        throw new Error(`expected 32-byte hex digest, received "${value}"`);
    }
    return Buffer.from(normalized, 'hex');
}

function encodeString(value: string): Buffer {
    const payload = Buffer.from(value, 'utf8');
    const lengthPrefix = Buffer.alloc(4);
    lengthPrefix.writeUInt32BE(payload.length, 0);
    return Buffer.concat([lengthPrefix, payload]);
}

function normalizeOpaqueHash(value: string): string {
    const normalized = value.trim();
    return /^0x[0-9a-f]{64}$/i.test(normalized) ? normalized.toLowerCase() : sha256Hex(normalized);
}

function buildDocumentCommitment(publicInputs: Omit<ZkpPublicInputs, 'documentCommitment'>): string {
    return sha256Hex(Buffer.concat([
        encodeString(publicInputs.schemaVersion),
        encodeString(publicInputs.documentWitnessMode),
        decodeDigestBytes(publicInputs.declaredDocHash),
        decodeDigestBytes(publicInputs.documentDigest),
        decodeDigestBytes(publicInputs.policyHash),
        decodeDigestBytes(publicInputs.inputsCommitment),
        encodeString(publicInputs.timestamp),
        Buffer.from([publicInputs.conformance ? 1 : 0])
    ]));
}

function buildWitness(
    input: ComplianceInput,
    backend: ZkpBackendMode
): { privateWitness: PrivateWitness; witnessMode: ZkpDocumentWitnessMode; documentBytes: Buffer } {
    if (input.canonicalDocumentBase64) {
        const documentBytes = Buffer.from(input.canonicalDocumentBase64, 'base64');
        if (documentBytes.length === 0) {
            throw new Error('canonicalDocumentBase64 decoded to an empty witness payload');
        }
        return {
            privateWitness: { canonicalDocumentBase64: input.canonicalDocumentBase64 },
            witnessMode: 'canonical-document-bytes-v1',
            documentBytes
        };
    }

    if (backend === 'external') {
        throw new Error('canonicalDocumentBase64 is required when TRUSTSIGNAL_ZKP_BACKEND=external');
    }

    const fallbackDocumentBytes = Buffer.from(input.docHash, 'utf8');
    return {
        privateWitness: { canonicalDocumentBase64: fallbackDocumentBytes.toString('base64') },
        witnessMode: 'declared-doc-hash-v1',
        documentBytes: fallbackDocumentBytes
    };
}

function buildPublicInputs(
    input: ComplianceInput,
    timestamp: string,
    backend: ZkpBackendMode
): { publicInputs: ZkpPublicInputs; privateWitness: PrivateWitness } {
    const { privateWitness, witnessMode, documentBytes } = buildWitness(input, backend);
    const publicInputsWithoutCommitment = {
        policyHash: keccak256(toUtf8Bytes(input.policyProfile)),
        timestamp,
        inputsCommitment: input.inputsCommitment,
        conformance: input.checksResult,
        declaredDocHash: normalizeOpaqueHash(input.docHash),
        documentDigest: sha256Hex(documentBytes),
        schemaVersion: DOCUMENT_SCHEMA_VERSION,
        documentWitnessMode: witnessMode
    } satisfies Omit<ZkpPublicInputs, 'documentCommitment'>;

    return {
        publicInputs: {
            ...publicInputsWithoutCommitment,
            documentCommitment: buildDocumentCommitment(publicInputsWithoutCommitment)
        },
        privateWitness
    };
}

function buildDevArtifactDigest(publicInputs: ZkpPublicInputs): string {
    return keccak256(toUtf8Bytes(JSON.stringify({
        backend: 'halo2-dev',
        status: 'dev-only',
        publicInputs
    })));
}

function resolveBackend(env: NodeJS.ProcessEnv = process.env): ZkpBackendMode {
    const configured = (env.TRUSTSIGNAL_ZKP_BACKEND || '').trim().toLowerCase();
    return configured === 'external' ? 'external' : 'dev-only';
}

function assertDevBackendAllowed(env: NodeJS.ProcessEnv = process.env): void {
    if ((env.NODE_ENV || '').toLowerCase() === 'production' && resolveBackend(env) !== 'external') {
        throw new Error('real prover backend required in production; dev-only Halo2 attestations are disabled');
    }
}

function assertProductionAttestation(attestation: ZKPAttestation, env: NodeJS.ProcessEnv = process.env): void {
    if ((env.NODE_ENV || '').toLowerCase() !== 'production') {
        return;
    }

    if (
        attestation.scheme !== 'HALO2-v1' ||
        attestation.status !== 'verifiable' ||
        attestation.backend !== 'halo2' ||
        attestation.circuitId !== DOCUMENT_CIRCUIT_ID ||
        !attestation.proofArtifact?.digest ||
        !attestation.proofArtifact?.format ||
        attestation.proofArtifact.encoding !== 'base64' ||
        !attestation.proofArtifact.proof ||
        !attestation.verificationKeyId ||
        !attestation.verifiedAt ||
        attestation.publicInputs.schemaVersion !== DOCUMENT_SCHEMA_VERSION ||
        attestation.publicInputs.documentWitnessMode !== 'canonical-document-bytes-v1'
    ) {
        throw new Error('production prover must return a verifiable Halo2 attestation with proof artifact and verification key metadata');
    }

    if (buildDocumentCommitment({
        policyHash: attestation.publicInputs.policyHash,
        timestamp: attestation.publicInputs.timestamp,
        inputsCommitment: attestation.publicInputs.inputsCommitment,
        conformance: attestation.publicInputs.conformance,
        declaredDocHash: attestation.publicInputs.declaredDocHash,
        documentDigest: attestation.publicInputs.documentDigest,
        schemaVersion: attestation.publicInputs.schemaVersion,
        documentWitnessMode: attestation.publicInputs.documentWitnessMode
    }) !== attestation.publicInputs.documentCommitment) {
        throw new Error('production prover returned an invalid document commitment');
    }
}

function parseExternalResponse(parsed: unknown): ExternalProverResponse {
    if (typeof parsed !== 'object' || parsed === null) {
        throw new Error('invalid external prover payload');
    }

    const record = parsed as Record<string, unknown>;
    if (record.attestation) {
        return { attestation: record.attestation as ZKPAttestation };
    }
    if (typeof record.verified === 'boolean') {
        return { verified: record.verified };
    }

    throw new Error('external prover payload missing attestation or verification result');
}

function rejectPendingRequests(processHandle: ExternalProcess, error: Error): void {
    for (const { reject } of processHandle.pending.values()) {
        reject(error);
    }
    processHandle.pending.clear();
}

function getExternalProcess(binaryPath: string): ExternalProcess {
    const cached = externalProcessCache.get(binaryPath);
    if (cached && !cached.child.killed && cached.child.exitCode === null) {
        return cached;
    }

    const child = spawn(binaryPath, [], {
        stdio: ['pipe', 'pipe', 'pipe']
    });
    const processHandle: ExternalProcess = {
        child,
        pending: new Map(),
        stdoutBuffer: '',
        stderrBuffer: ''
    };

    child.stdout.on('data', (chunk: Buffer | string) => {
        processHandle.stdoutBuffer += chunk.toString();
        let newlineIndex = processHandle.stdoutBuffer.indexOf('\n');
        while (newlineIndex >= 0) {
            const rawLine = processHandle.stdoutBuffer.slice(0, newlineIndex).trim();
            processHandle.stdoutBuffer = processHandle.stdoutBuffer.slice(newlineIndex + 1);
            if (rawLine.length > 0) {
                try {
                    const parsed = JSON.parse(rawLine) as Record<string, unknown>;
                    const requestId = typeof parsed.requestId === 'string' ? parsed.requestId : undefined;
                    if (!requestId) {
                        throw new Error('external prover response missing requestId');
                    }
                    delete parsed.requestId;
                    const pending = processHandle.pending.get(requestId);
                    if (pending) {
                        processHandle.pending.delete(requestId);
                        pending.resolve(parseExternalResponse(parsed));
                    }
                } catch (error) {
                    rejectPendingRequests(
                        processHandle,
                        error instanceof Error ? error : new Error(String(error))
                    );
                    child.kill();
                    externalProcessCache.delete(binaryPath);
                    return;
                }
            }
            newlineIndex = processHandle.stdoutBuffer.indexOf('\n');
        }
    });

    child.stderr.on('data', (chunk: Buffer | string) => {
        processHandle.stderrBuffer += chunk.toString();
    });

    child.on('error', (error) => {
        rejectPendingRequests(processHandle, error);
        externalProcessCache.delete(binaryPath);
    });

    child.on('close', (exitCode) => {
        const output = processHandle.stderrBuffer.trim() || processHandle.stdoutBuffer.trim();
        rejectPendingRequests(
            processHandle,
            new Error(`external prover exited with code ${exitCode ?? 'unknown'}: ${output}`)
        );
        externalProcessCache.delete(binaryPath);
    });

    externalProcessCache.set(binaryPath, processHandle);
    return processHandle;
}

function runExternalCommand(binaryPath: string, request: ExternalProverRequest): Promise<ExternalProverResponse> {
    const processHandle = getExternalProcess(binaryPath);
    const requestId = randomUUID();

    return new Promise((resolve, reject) => {
        processHandle.pending.set(requestId, { resolve, reject });
        processHandle.child.stdin.write(
            `${JSON.stringify({ requestId, ...request })}\n`,
            (error) => {
                if (error) {
                    processHandle.pending.delete(requestId);
                    reject(error);
                }
            }
        );
    });
}

export async function generateComplianceProof(input: ComplianceInput): Promise<ZKPAttestation> {
    const backend = resolveBackend();
    const timestamp = new Date().toISOString();
    const { publicInputs, privateWitness } = buildPublicInputs(input, timestamp, backend);
    if (backend === 'external') {
        const proverBinary = (process.env.TRUSTSIGNAL_ZKP_PROVER_BIN || '').trim();
        if (!proverBinary) {
            throw new Error('TRUSTSIGNAL_ZKP_PROVER_BIN is required when TRUSTSIGNAL_ZKP_BACKEND=external');
        }

        const response = await runExternalCommand(proverBinary, {
            action: 'prove',
            publicInputs,
            privateWitness
        });

        if (!('attestation' in response)) {
            throw new Error('external prover did not return an attestation');
        }

        if (JSON.stringify(response.attestation.publicInputs) !== JSON.stringify(publicInputs)) {
            throw new Error('external prover returned public inputs that do not match the requested attestation');
        }

        assertProductionAttestation(response.attestation);
        return response.attestation;
    }

    assertDevBackendAllowed();

    console.warn('[zkp:MOCK] dev-only Halo2 attestation -- not a real proof. Set TRUSTSIGNAL_ZKP_BACKEND=external with a production prover binary for verifiable proofs.');

    return {
        proofId: randomUUID(),
        scheme: 'HALO2-DEV-v0',
        status: 'dev-only',
        backend: 'halo2-dev',
        circuitId: DOCUMENT_CIRCUIT_ID,
        publicInputs,
        proofArtifact: {
            format: 'keccak256',
            digest: buildDevArtifactDigest(publicInputs)
        }
    };
}

export async function verifyComplianceProof(attestation: ZKPAttestation): Promise<boolean> {
    if (attestation.status !== 'verifiable') return false;
    if (attestation.scheme !== 'HALO2-v1' || attestation.backend !== 'halo2') return false;
    if (
        attestation.circuitId !== DOCUMENT_CIRCUIT_ID ||
        !attestation.verifiedAt ||
        !attestation.verificationKeyId ||
        !attestation.proofArtifact ||
        attestation.proofArtifact.encoding !== 'base64' ||
        !attestation.proofArtifact.proof
    ) {
        return false;
    }

    const verifierBinary = (process.env.TRUSTSIGNAL_ZKP_VERIFIER_BIN || process.env.TRUSTSIGNAL_ZKP_PROVER_BIN || '').trim();
    if (!verifierBinary) return false;

    const response = await runExternalCommand(verifierBinary, {
        action: 'verify',
        attestation
    });
    if (!('verified' in response) || response.verified !== true) return false;

    if (attestation.publicInputs.schemaVersion !== DOCUMENT_SCHEMA_VERSION) return false;
    if (attestation.publicInputs.documentWitnessMode !== 'canonical-document-bytes-v1') return false;
    if (buildDocumentCommitment({
        policyHash: attestation.publicInputs.policyHash,
        timestamp: attestation.publicInputs.timestamp,
        inputsCommitment: attestation.publicInputs.inputsCommitment,
        conformance: attestation.publicInputs.conformance,
        declaredDocHash: attestation.publicInputs.declaredDocHash,
        documentDigest: attestation.publicInputs.documentDigest,
        schemaVersion: attestation.publicInputs.schemaVersion,
        documentWitnessMode: attestation.publicInputs.documentWitnessMode
    }) !== attestation.publicInputs.documentCommitment) {
        return false;
    }

    const { conformance } = attestation.publicInputs;
    return conformance === true;
}
