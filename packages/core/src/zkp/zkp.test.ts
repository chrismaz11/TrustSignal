import { chmodSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Buffer } from 'node:buffer';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateComplianceProof, verifyComplianceProof } from './index.js';

const slowProofIt = process.env.RUN_SLOW_ZKP_TESTS === '1' ? it : it.skip;

describe('ZKP Compliance', () => {
    it('generates a dev-only attestation for non-production environments', async () => {
        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: true,
            inputsCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            docHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        };

        const attestation = await generateComplianceProof(input);
        expect(attestation.scheme).toBe('HALO2-DEV-v0');
        expect(attestation.status).toBe('dev-only');
        expect(attestation.backend).toBe('halo2-dev');
        expect(attestation.circuitId).toBe('document-sha256-v1');
        expect(attestation.publicInputs.conformance).toBe(true);
        expect(attestation.publicInputs.schemaVersion).toBe('trustsignal.document_sha256.v1');
        expect(attestation.publicInputs.documentWitnessMode).toBe('declared-doc-hash-v1');
        expect(attestation.publicInputs.documentDigest).toMatch(/^0x[0-9a-f]{64}$/);
        expect(attestation.publicInputs.documentCommitment).toMatch(/^0x[0-9a-f]{64}$/);
        expect(attestation.proofArtifact?.digest).toBeDefined();

        const isValid = await verifyComplianceProof(attestation);
        expect(isValid).toBe(false);
    });

    it('fails closed in production until a real prover is configured', async () => {
        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: false,
            inputsCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            docHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd'
        };

        const previousNodeEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        try {
            await expect(generateComplianceProof(input)).rejects.toThrow(
                'real prover backend required in production; dev-only Halo2 attestations are disabled'
            );
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
        }
    });

    it('rejects external dev-only attestations in production', async () => {
        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: true,
            inputsCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            docHash: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd',
            canonicalDocumentBase64: Buffer.from('%PDF-1.4\nsample', 'utf8').toString('base64')
        };
        const scriptPath = path.join(os.tmpdir(), `trustsignal-zkp-dev-${Date.now()}.mjs`);
        writeFileSync(
            scriptPath,
            [
                "#!/usr/bin/env node",
                "process.stdin.setEncoding('utf8');",
                "let buffer = '';",
                "process.stdin.on('data', (chunk) => {",
                "  buffer += chunk;",
                "  let newlineIndex = buffer.indexOf('\\n');",
                "  while (newlineIndex >= 0) {",
                "    const rawLine = buffer.slice(0, newlineIndex).trim();",
                "    buffer = buffer.slice(newlineIndex + 1);",
                "    if (rawLine.length > 0) {",
                "      const request = JSON.parse(rawLine);",
                "      if (request.action !== 'prove') process.exit(1);",
                "      process.stdout.write(JSON.stringify({",
                "        requestId: request.requestId,",
                "        attestation: {",
                "          proofId: 'proof-dev',",
                "          scheme: 'HALO2-DEV-v0',",
                "          status: 'dev-only',",
                "          backend: 'halo2-dev',",
                "          circuitId: 'document-sha256-v1',",
                "          publicInputs: request.publicInputs,",
                "          proofArtifact: { format: 'keccak256', digest: '0xdigest' }",
                "        }",
                "      }) + '\\n');",
                "    }",
                "    newlineIndex = buffer.indexOf('\\n');",
                "  }",
                "});"
            ].join('\n')
        );
        chmodSync(scriptPath, 0o755);

        const previousNodeEnv = process.env.NODE_ENV;
        const previousBackend = process.env.TRUSTSIGNAL_ZKP_BACKEND;
        const previousProver = process.env.TRUSTSIGNAL_ZKP_PROVER_BIN;
        process.env.NODE_ENV = 'production';
        process.env.TRUSTSIGNAL_ZKP_BACKEND = 'external';
        process.env.TRUSTSIGNAL_ZKP_PROVER_BIN = scriptPath;
        try {
            await expect(
                generateComplianceProof(input)
            ).rejects.toThrow('production prover must return a verifiable Halo2 attestation with proof artifact and verification key metadata');
        } finally {
            process.env.NODE_ENV = previousNodeEnv;
            if (previousBackend === undefined) {
                delete process.env.TRUSTSIGNAL_ZKP_BACKEND;
            } else {
                process.env.TRUSTSIGNAL_ZKP_BACKEND = previousBackend;
            }
            if (previousProver === undefined) {
                delete process.env.TRUSTSIGNAL_ZKP_PROVER_BIN;
            } else {
                process.env.TRUSTSIGNAL_ZKP_PROVER_BIN = previousProver;
            }
        }
    });

    slowProofIt('verifies a real external Halo2 document attestation', async () => {
        const input = {
            policyProfile: 'STANDARD_CA',
            checksResult: true,
            inputsCommitment: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
            docHash: '0xd2c59808f4bcb6d57e0169fb0fb3d3c16f2c6d082b8dc4b12f3ecacc10bd4f43',
            canonicalDocumentBase64: Buffer.from('%PDF-1.4\nsample', 'utf8').toString('base64')
        };
        const binaryPath = path.resolve(process.cwd(), 'circuits/non_mem_gadget/target/release/zkp_service');
        execFileSync('cargo', ['build', '--release', '--manifest-path', 'circuits/non_mem_gadget/Cargo.toml', '--bin', 'zkp_service'], {
            stdio: 'ignore'
        });

        const previousBackend = process.env.TRUSTSIGNAL_ZKP_BACKEND;
        const previousProver = process.env.TRUSTSIGNAL_ZKP_PROVER_BIN;
        const previousVerifier = process.env.TRUSTSIGNAL_ZKP_VERIFIER_BIN;
        process.env.TRUSTSIGNAL_ZKP_BACKEND = 'external';
        process.env.TRUSTSIGNAL_ZKP_PROVER_BIN = binaryPath;
        process.env.TRUSTSIGNAL_ZKP_VERIFIER_BIN = binaryPath;
        try {
            const attestation = await generateComplianceProof(input);
            expect(attestation.scheme).toBe('HALO2-v1');
            expect(attestation.status).toBe('verifiable');
            expect(attestation.backend).toBe('halo2');
            expect(attestation.circuitId).toBe('document-sha256-v1');
            expect(attestation.verificationKeyId).toBeTruthy();
            expect(attestation.proofArtifact?.encoding).toBe('base64');
            expect(attestation.proofArtifact?.proof).toBeTruthy();
            expect(attestation.publicInputs.documentWitnessMode).toBe('canonical-document-bytes-v1');
            expect(attestation.publicInputs.documentDigest).toMatch(/^0x[0-9a-f]{64}$/);

            await expect(verifyComplianceProof(attestation)).resolves.toBe(true);
        } finally {
            if (previousBackend === undefined) {
                delete process.env.TRUSTSIGNAL_ZKP_BACKEND;
            } else {
                process.env.TRUSTSIGNAL_ZKP_BACKEND = previousBackend;
            }
            if (previousProver === undefined) {
                delete process.env.TRUSTSIGNAL_ZKP_PROVER_BIN;
            } else {
                process.env.TRUSTSIGNAL_ZKP_PROVER_BIN = previousProver;
            }
            if (previousVerifier === undefined) {
                delete process.env.TRUSTSIGNAL_ZKP_VERIFIER_BIN;
            } else {
                process.env.TRUSTSIGNAL_ZKP_VERIFIER_BIN = previousVerifier;
            }
        }
    }, 120000);
});
