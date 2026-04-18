/**
 * ICE Mortgage Technology — TrustSignal Sandbox Integration Tests
 *
 * Simulates what a live ICE Encompass integration would look like.
 * Uses the mock ICE API (no real credentials or network) and runs
 * against the full TrustSignal API server in-process.
 *
 * Scenarios:
 *   1. Clean closing                  → expects ALLOW
 *   2. Notary commission state mismatch → expects FLAG or BLOCK
 *   3. Tampered seal payload           → expects FLAG or BLOCK
 *   4. Rapid-fire duplicate submission → expects FLAG or BLOCK
 *   5. Revocation flow                 → verify → revoke → confirm revoked
 *
 * Results are saved to sandbox-results/ as JSON for demo and audit evidence.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { FastifyInstance } from 'fastify';
import { Wallet, keccak256, toUtf8Bytes } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildServer } from '../../apps/api/src/server.js';
import { getAllLoans, getLoan } from './mock-ice-api.js';
import { adaptLoanToBundle } from './ice-adaptor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const hasDatabaseUrl =
  Boolean(process.env.DATABASE_URL) ||
  Boolean(process.env.SUPABASE_DB_URL) ||
  Boolean(process.env.SUPABASE_POOLER_URL) ||
  Boolean(process.env.SUPABASE_DIRECT_URL);

const describeWithDatabase = hasDatabaseUrl ? describe : describe.skip;

// Sandbox API key and revocation signer (dev-only, not production values)
const SANDBOX_API_KEY = 'ice-sandbox-test-key';
const revocationSigner = Wallet.createRandom();

type SandboxResult = {
  scenario: string;
  loanNumber: string;
  input: Record<string, unknown>;
  response: Record<string, unknown>;
  assertions: string[];
  passed: boolean;
};

const results: SandboxResult[] = [];

function saveResults() {
  const dir = join(__dirname, 'sandbox-results');
  mkdirSync(dir, { recursive: true });
  const filename = `ice-mortgage-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  const output = {
    generatedAt: new Date().toISOString(),
    integration: 'ICE Mortgage Technology (Encompass) — Sandbox',
    apiVersion: 'TrustSignal API v2 / api/v1',
    scenarios: results
  };
  writeFileSync(join(dir, filename), JSON.stringify(output, null, 2));
  console.log(`\nSandbox results saved → sandbox-results/${filename}`);
}

describeWithDatabase('ICE Mortgage Technology — Sandbox', () => {
  let app: FastifyInstance;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS = SANDBOX_API_KEY;
    process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEY_SCOPES =
      `${SANDBOX_API_KEY}=verify|read|anchor|revoke`;
    process.env.REVOCATION_ISSUERS = `ice-sandbox-issuer=${revocationSigner.address}`;

    prisma = new PrismaClient();
    app = await buildServer();
  });

  afterAll(async () => {
    saveResults();
    await app.close();
    await prisma.$disconnect();
    delete process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEYS;
    delete process.env.TRUSTSIGNAL_LOCAL_DEV_API_KEY_SCOPES;
    delete process.env.REVOCATION_ISSUERS;
  });

  // ─── Scenario 1: Clean closing ─────────────────────────────────────────────

  it('Scenario 1: clean closing is ALLOWed', async () => {
    const loan = getLoan('LOAN-2026-001')!;
    const bundle = await adaptLoanToBundle(loan);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': SANDBOX_API_KEY },
      payload: bundle
    });

    expect(res.statusCode).toBe(200);
    const receipt = res.json();

    expect(receipt.receiptVersion).toBe('2.0');
    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.decision).toBe('ALLOW');
    expect(receipt.status).toBe('clean');
    expect(receipt.receiptSignature?.alg).toBe('EdDSA');
    expect(receipt.revocation.status).toBe('ACTIVE');

    results.push({
      scenario: 'Scenario 1 — Clean closing',
      loanNumber: loan.loanNumber,
      input: { loanNumber: loan.loanNumber, state: loan.state, notaryState: loan.eClosing.notaryCommissionState },
      response: {
        receiptId: receipt.receiptId,
        decision: receipt.decision,
        status: receipt.status,
        fraudRisk: receipt.fraudRisk
      },
      assertions: ['decision === ALLOW', 'status === clean', 'EdDSA signature present'],
      passed: true
    });
  });

  // ─── Scenario 2: Notary commission state mismatch ─────────────────────────

  it('Scenario 2: notary commission state mismatch is flagged', async () => {
    const loan = getLoan('LOAN-2026-002')!;
    const bundle = await adaptLoanToBundle(loan);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': SANDBOX_API_KEY },
      payload: bundle
    });

    expect(res.statusCode).toBe(200);
    const receipt = res.json();

    expect(receipt.receiptVersion).toBe('2.0');
    expect(receipt.receiptId).toBeTruthy();
    expect(['FLAG', 'BLOCK']).toContain(receipt.decision);
    expect(['failure', 'compliance_gap']).toContain(receipt.status);

    results.push({
      scenario: 'Scenario 2 — Notary commission state mismatch (CA notary, IL closing)',
      loanNumber: loan.loanNumber,
      input: { loanNumber: loan.loanNumber, closingState: loan.state, notaryState: loan.eClosing.notaryCommissionState },
      response: {
        receiptId: receipt.receiptId,
        decision: receipt.decision,
        status: receipt.status,
        reasons: receipt.reasons,
        fraudRisk: receipt.fraudRisk
      },
      assertions: ['decision in [FLAG, BLOCK]', 'status in [failure, compliance_gap]'],
      passed: true
    });
  });

  // ─── Scenario 3: Tampered seal payload ─────────────────────────────────────

  it('Scenario 3: tampered seal payload is rejected', async () => {
    const loan = getLoan('LOAN-2026-003')!;
    const bundle = await adaptLoanToBundle(loan);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': SANDBOX_API_KEY },
      payload: bundle
    });

    expect(res.statusCode).toBe(200);
    const receipt = res.json();

    expect(receipt.receiptVersion).toBe('2.0');
    expect(receipt.receiptId).toBeTruthy();
    expect(['FLAG', 'BLOCK']).toContain(receipt.decision);

    results.push({
      scenario: 'Scenario 3 — Tampered seal payload',
      loanNumber: loan.loanNumber,
      input: { loanNumber: loan.loanNumber, sealPayload: loan.eClosing.sealPayload },
      response: {
        receiptId: receipt.receiptId,
        decision: receipt.decision,
        status: receipt.status,
        reasons: receipt.reasons
      },
      assertions: ['decision in [FLAG, BLOCK]'],
      passed: true
    });
  });

  // ─── Scenario 4: Rapid-fire duplicate submission ────────────────────────────

  it('Scenario 4: duplicate submission is flagged', async () => {
    const loan = getLoan('LOAN-2026-004')!;
    const bundle = await adaptLoanToBundle(loan);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': SANDBOX_API_KEY },
      payload: bundle
    });

    expect(res.statusCode).toBe(200);
    const receipt = res.json();

    expect(receipt.receiptVersion).toBe('2.0');
    expect(receipt.receiptId).toBeTruthy();
    // RAPID- prefix or duplicate parcel should trigger FLAG or BLOCK
    expect(['FLAG', 'BLOCK']).toContain(receipt.decision);

    results.push({
      scenario: 'Scenario 4 — Rapid-fire duplicate submission (same parcel, same borrower)',
      loanNumber: loan.loanNumber,
      input: { loanNumber: loan.loanNumber, parcelId: loan.parcelId },
      response: {
        receiptId: receipt.receiptId,
        decision: receipt.decision,
        status: receipt.status,
        reasons: receipt.reasons
      },
      assertions: ['decision in [FLAG, BLOCK]'],
      passed: true
    });
  });

  // ─── Scenario 5: Revocation flow ───────────────────────────────────────────

  it('Scenario 5: verified receipt can be revoked and shows revoked status', async () => {
    const loan = getLoan('LOAN-2026-005')!;
    const bundle = await adaptLoanToBundle(loan);

    // Step 1: Verify
    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': SANDBOX_API_KEY },
      payload: bundle
    });
    expect(verifyRes.statusCode).toBe(200);
    const receipt = verifyRes.json();
    expect(receipt.receiptId).toBeTruthy();
    expect(receipt.decision).toBe('ALLOW');

    const receiptId: string = receipt.receiptId;

    // Step 2: Revoke (court-order scenario)
    const timestamp = Date.now().toString();
    const message = `revoke:${receiptId}:${timestamp}`;
    const signature = await revocationSigner.signMessage(message);

    const revokeRes = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receiptId}/revoke`,
      headers: {
        'x-api-key': SANDBOX_API_KEY,
        'x-issuer-id': 'ice-sandbox-issuer',
        'x-issuer-signature': signature,
        'x-signature-timestamp': timestamp
      }
    });
    expect(revokeRes.statusCode).toBe(200);
    const revokeBody = revokeRes.json();
    expect(revokeBody.result).toBe('REVOKED');

    // Step 3: Fetch receipt and confirm revoked
    const fetchRes = await app.inject({
      method: 'GET',
      url: `/api/v1/receipt/${receiptId}`,
      headers: { 'x-api-key': SANDBOX_API_KEY }
    });
    expect(fetchRes.statusCode).toBe(200);
    const fetched = fetchRes.json();
    expect(fetched.revocation.status).toBe('REVOKED');
    expect(fetched.status).toBe('revoked');

    results.push({
      scenario: 'Scenario 5 — Revocation flow (verify → revoke → confirm revoked)',
      loanNumber: loan.loanNumber,
      input: { loanNumber: loan.loanNumber },
      response: {
        receiptId,
        initialDecision: receipt.decision,
        revokeResult: revokeBody.result,
        finalStatus: fetched.status,
        finalRevocationStatus: fetched.revocation.status
      },
      assertions: [
        'initial decision === ALLOW',
        'revokeResult === REVOKED',
        'final status === revoked',
        'final revocation.status === REVOKED'
      ],
      passed: true
    });
  });
});
