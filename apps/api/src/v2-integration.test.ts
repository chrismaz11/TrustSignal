import 'dotenv/config';
import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from './server.js';
import { Buffer } from 'node:buffer';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('V2 Feature Integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildServer();
        // Create Test Org
        await prisma.organization.upsert({
            where: { apiKey: 'test-api-key' },
            create: {
                name: 'Test Org',
                adminEmail: 'test@example.com',
                apiKey: 'test-api-key'
            },
            update: {}
        });
    });

    it('verifies bundle with Risk analysis and ZKP', async () => {
        // 1. Get synthetic bundle
        const syntheticRes = await app.inject({
            method: 'GET',
            url: '/api/v1/synthetic'
        });
        const bundle = syntheticRes.json();

        // Add PDF content for Risk Engine (Base64)
        // Add PDF content for Risk Engine (Base64)
        const pdfBuffer = Buffer.from('%PDF-1.4\nCALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT\npenalty of perjury');
        bundle.doc.pdfBase64 = pdfBuffer.toString('base64');
        // Update hash to match the new PDF content (calculated from error log)
        bundle.doc.docHash = '0x72be470fc03f8c093d6bc61cc91b428db88396b65030dd7d9305a3f297152f7c';

        // 2. Verify
        const verifyRes = await app.inject({
            method: 'POST',
            url: '/api/v1/verify',
            headers: { 'x-api-key': 'test-api-key' },
            payload: bundle
        });

        console.log('Verify Status:', verifyRes.statusCode);
        console.log('Verify Body:', verifyRes.body);

        expect(verifyRes.statusCode).toBe(200);
        const receipt = verifyRes.json();

        expect(receipt.receiptVersion).toBe("2.0");

        expect(receipt.fraudRisk).toBeTruthy();
        expect(receipt.fraudRisk.score).toBeGreaterThanOrEqual(0);
        expect(receipt.fraudRisk.score).toBeLessThanOrEqual(1);
        expect(["LOW", "MEDIUM", "HIGH"]).toContain(receipt.fraudRisk.band);

        expect(receipt.zkpAttestation).toBeDefined();
        expect(receipt.zkpAttestation.scheme).toBe('GROTH16-MOCK-v1');

        expect(receipt.revocation).toBeTruthy();
        expect(["ACTIVE", "REVOKED"]).toContain(receipt.revocation.status);

        // old fields must NOT exist at top level
        expect(receipt.riskScore).toBeUndefined();
        expect(receipt.revoked).toBeUndefined();

        // 3. Check Receipt Details
        const receiptRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`,
            headers: { 'x-api-key': 'test-api-key' }
        });
        const fetched = receiptRes.json();
        expect(fetched.receipt.fraudRisk).toBeDefined();
        expect(fetched.revoked).toBeUndefined();
        expect(fetched.revocation).toBeTruthy();

        // 4. Verify Receipt endpoint
        const checkRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/verify`,
            headers: { 'x-api-key': 'test-api-key' }
        });
        const check = checkRes.json();
        expect(check.verified).toBe(true);

        // 5. Revoke
        const revokeRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/revoke`,
            headers: { 'x-api-key': 'test-api-key' }
        });
        expect(revokeRes.json().status).toBe('REVOKED');

        // 6. Check Revoked Status
        const revokedCheckRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`,
            headers: { 'x-api-key': 'test-api-key' }
        });
        expect(revokedCheckRes.json().revocation.status).toBe("REVOKED");
        expect(revokedCheckRes.json().revocation.status).toBe("REVOKED");

        // 7. Test List endpoint (protected)
        const listRes = await app.inject({
            method: 'GET',
            url: '/api/v1/receipts',
            headers: { 'x-api-key': 'test-api-key' }
        });
        expect(listRes.statusCode).toBe(200);
        expect(listRes.json().data.length).toBeGreaterThan(0);
        
        // 8. Test Unauthorized List endpoint
        const listRes401 = await app.inject({
            method: 'GET',
            url: '/api/v1/receipts'
        });
        expect(listRes401.statusCode).toBe(401);
    });
});
