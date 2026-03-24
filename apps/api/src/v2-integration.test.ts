import { Buffer } from 'node:buffer';

import { FastifyInstance } from 'fastify';
import { Wallet } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from './server.js';

const hasDatabaseUrl =
  Boolean(process.env.DATABASE_URL) ||
  Boolean(process.env.SUPABASE_DB_URL) ||
  Boolean(process.env.SUPABASE_POOLER_URL) ||
  Boolean(process.env.SUPABASE_DIRECT_URL);
const describeWithDatabase = hasDatabaseUrl ? describe : describe.skip;

describeWithDatabase('V2 Feature Integration', () => {
    let app: FastifyInstance;
    let prisma: PrismaClient;
    const apiKey = 'test-api-key';
    const revocationSigner = Wallet.createRandom();

    beforeAll(async () => {
        process.env.API_KEYS = apiKey;
        process.env.API_KEY_SCOPES = `${apiKey}=verify|read|anchor|revoke`;
        process.env.REVOCATION_ISSUERS = `issuer-test=${revocationSigner.address}`;
        prisma = new PrismaClient();
        app = await buildServer();
    });

    afterAll(async () => {
        await app.close();
        await prisma.$disconnect();
        delete process.env.API_KEYS;
        delete process.env.API_KEY_SCOPES;
        delete process.env.REVOCATION_ISSUERS;
    });

    it('verifies bundle with Risk analysis and ZKP', async () => {
        // 1. Get synthetic bundle
        const syntheticRes = await app.inject({
            method: 'GET',
            url: '/api/v1/synthetic',
            headers: { 'x-api-key': apiKey }
        });
        expect(syntheticRes.statusCode).toBe(200);
        const bundle = syntheticRes.json();

        // Add PDF content for Risk Engine (Base64)
        // Add PDF content for Risk Engine (Base64)
        // Must include keywords to pass Layout & Pattern checks (assuming CA or generic)
        bundle.doc.pdfBase64 = Buffer.from('%PDF-1.4\nCALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT\npenalty of perjury').toString('base64');

        // 2. Verify
        const verifyRes = await app.inject({
            method: 'POST',
            url: '/api/v1/verify',
            headers: { 'x-api-key': apiKey },
            payload: bundle
        });

        expect(verifyRes.statusCode).toBe(200);
        const receipt = verifyRes.json();

        expect(receipt.receiptVersion).toBe("2.0");
        expect(receipt.receiptSignature).toBeTruthy();
        expect(receipt.receiptSignature.alg).toBe('EdDSA');
        expect(typeof receipt.receiptSignature.kid).toBe('string');
        expect(typeof receipt.receiptSignature.signature).toBe('string');

        expect(receipt.fraudRisk).toBeTruthy();
        expect(receipt.fraudRisk.score).toBeGreaterThanOrEqual(0);
        expect(receipt.fraudRisk.score).toBeLessThanOrEqual(1);
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(receipt.fraudRisk.band);

        expect(receipt.zkpAttestation).toBeDefined();
        expect(receipt.zkpAttestation.scheme).toBe('HALO2-DEV-v0');
        expect(receipt.zkpAttestation.status).toBe('dev-only');
        expect(receipt.zkpAttestation.backend).toBe('halo2-dev');
        expect(receipt.zkpAttestation.circuitId).toBe('document-sha256-v1');
        expect(receipt.zkpAttestation.publicInputs.documentWitnessMode).toBe('canonical-document-bytes-v1');
        expect(receipt.zkpAttestation.publicInputs.schemaVersion).toBe('trustsignal.document_sha256.v1');
        expect(typeof receipt.zkpAttestation.publicInputs.declaredDocHash).toBe('string');
        expect(typeof receipt.zkpAttestation.publicInputs.documentDigest).toBe('string');
        expect(typeof receipt.zkpAttestation.publicInputs.documentCommitment).toBe('string');
        expect(typeof receipt.zkpAttestation.proofArtifact?.digest).toBe('string');
        expect(receipt.zkpAttestation.verificationKeyId).toBeUndefined();
        expect(receipt.zkpAttestation.verifiedAt).toBeUndefined();
        expect(receipt.zkpAttestation.proofArtifact?.encoding).toBeUndefined();
        expect(receipt.zkpAttestation.proofArtifact?.proof).toBeUndefined();
        expect(receipt.proofVerified).toBe(false);
        expect(receipt.anchor.backend).toBe('EVM_LOCAL');
        expect(typeof receipt.anchor.subjectDigest).toBe('string');
        expect(receipt.anchor.subjectVersion).toBe('trustsignal.anchor_subject.v1');

        expect(receipt.revocation).toBeTruthy();
        expect(["ACTIVE", "REVOKED"]).toContain(receipt.revocation.status);

        // old fields must NOT exist at top level
        expect(receipt.riskScore).toBeUndefined();
        expect(receipt.revoked).toBeUndefined();

        // 3. Check Receipt Details
        const receiptRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`,
            headers: { 'x-api-key': apiKey }
        });
        const fetched = receiptRes.json();
        expect(fetched.receipt.fraudRisk).toBeDefined();
        expect(fetched.revoked).toBeUndefined();
        expect(fetched.revocation).toBeTruthy();
        expect(fetched.zkpAttestation.status).toBe('dev-only');
        expect(fetched.zkpAttestation.verificationKeyId).toBeUndefined();
        expect(fetched.zkpAttestation.proofArtifact?.proof).toBeUndefined();
        expect(fetched.proofVerified).toBe(false);
        expect(typeof fetched.anchor.subjectDigest).toBe('string');

        // 4. Verify Receipt endpoint
        const checkRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/verify`,
            headers: { 'x-api-key': apiKey }
        });
        const check = checkRes.json();
        expect(check.verified).toBe(true);
        expect(check.integrityVerified).toBe(true);
        expect(check.signatureVerified).toBe(true);
        expect(check.signatureStatus).toBe('verified');
        expect(check.proofVerified).toBe(false);
        expect(check.recomputedHash).toBe(receipt.receiptHash);
        expect(check.receiptSignature.alg).toBe('EdDSA');
        expect(typeof check.receiptSignature.kid).toBe('string');

        // 5. Revoke
        const revocationTimestamp = Date.now().toString();
        const revocationMessage = `revoke:${receipt.receiptId}:${revocationTimestamp}`;
        const revocationSignature = await revocationSigner.signMessage(revocationMessage);
        const revokeRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/revoke`,
            headers: {
                'x-api-key': apiKey,
                'x-issuer-id': 'issuer-test',
                'x-signature-timestamp': revocationTimestamp,
                'x-issuer-signature': revocationSignature
            }
        });
        expect(revokeRes.json().status).toBe('REVOKED');

        // 6. Check Revoked Status
        const revokedCheckRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`,
            headers: { 'x-api-key': apiKey }
        });
        expect(revokedCheckRes.json().revocation.status).toBe("REVOKED");
    });

    it('verifies a persisted legacy unsigned receipt without crashing', async () => {
        const syntheticRes = await app.inject({
            method: 'GET',
            url: '/api/v1/synthetic',
            headers: { 'x-api-key': apiKey }
        });
        expect(syntheticRes.statusCode).toBe(200);
        const bundle = syntheticRes.json();
        bundle.doc.pdfBase64 = Buffer.from('%PDF-1.4\nlegacy-unsigned', 'utf8').toString('base64');

        const verifyRes = await app.inject({
            method: 'POST',
            url: '/api/v1/verify',
            headers: { 'x-api-key': apiKey },
            payload: bundle
        });
        expect(verifyRes.statusCode).toBe(200);
        const receipt = verifyRes.json();

        await prisma.receipt.update({
            where: { id: receipt.receiptId },
            data: {
                receiptSignature: null,
                receiptSignatureAlg: null,
                receiptSignatureKid: null
            }
        });

        const legacyVerifyRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/verify`,
            headers: { 'x-api-key': apiKey }
        });

        expect(legacyVerifyRes.statusCode).toBe(200);
        const legacyCheck = legacyVerifyRes.json();
        expect(legacyCheck.integrityVerified).toBe(true);
        expect(legacyCheck.signatureVerified).toBe(false);
        expect(legacyCheck.signatureStatus).toBe('legacy-unsigned');
        expect(legacyCheck.signatureReason).toBe('receipt_signature_missing');
        expect(legacyCheck.receiptSignature).toBeNull();
    });
});
