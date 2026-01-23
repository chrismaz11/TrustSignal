import { describe, it, expect, beforeAll } from 'vitest';
import { buildServer } from './server.js';
import { Buffer } from 'node:buffer';
import { FastifyInstance } from 'fastify';

describe('V2 Feature Integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
        app = await buildServer();
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
        // Must include keywords to pass Layout & Pattern checks (assuming CA or generic)
        bundle.doc.pdfBase64 = Buffer.from('%PDF-1.4\nCALIFORNIA ALL-PURPOSE ACKNOWLEDGMENT\npenalty of perjury').toString('base64');

        // 2. Verify
        const verifyRes = await app.inject({
            method: 'POST',
            url: '/api/v1/verify',
            payload: bundle
        });

        console.log('Verify Status:', verifyRes.statusCode);
        console.log('Verify Body:', verifyRes.body);

        expect(verifyRes.statusCode).toBe(200);
        const receipt = verifyRes.json();

        expect(receipt.fraudRisk).toBeDefined();
        expect(receipt.fraudRisk.band).toBe('LOW'); // The mock PDF is clean-ish
        expect(receipt.zkpAttestation).toBeDefined();
        expect(receipt.zkpAttestation.scheme).toBe('GROTH16-MOCK-v1');
        expect(receipt.revoked).toBe(false);

        // 3. Check Receipt Details
        const receiptRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`
        });
        const fetched = receiptRes.json();
        expect(fetched.receipt.fraudRisk).toBeDefined();
        expect(fetched.revoked).toBe(false);

        // 4. Verify Receipt endpoint
        const checkRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/verify`
        });
        const check = checkRes.json();
        expect(check.verified).toBe(true);

        // 5. Revoke
        const revokeRes = await app.inject({
            method: 'POST',
            url: `/api/v1/receipt/${receipt.receiptId}/revoke`
        });
        expect(revokeRes.json().status).toBe('REVOKED');

        // 6. Check Revoked Status
        const revokedCheckRes = await app.inject({
            method: 'GET',
            url: `/api/v1/receipt/${receipt.receiptId}`
        });
        expect(revokedCheckRes.json().revoked).toBe(true);
    });
});
