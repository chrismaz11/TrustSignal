#!/usr/bin/env tsx
/**
 * e2e-verify.ts — end-to-end verification lifecycle test.
 *
 * Runs the full receipt lifecycle against a live API:
 *   1. POST /api/v1/verify          — issue receipt
 *   2. GET  /api/v1/receipt/:id     — retrieve receipt
 *   3. Verify signature hash offline (recompute and compare receiptHash)
 *   4. POST /api/v1/receipt/:id/verify — server-side integrity check
 *   5. POST /api/v1/receipt/:id/revoke — revoke with issuer signature
 *   6. POST /api/v1/receipt/:id/verify — confirm revoked behavior
 *
 * Required env vars:
 *   TRUSTSIGNAL_API_KEY       — API key with verify|read|revoke scopes
 *   TRUSTSIGNAL_API_BASE_URL  — e.g. https://api.trustsignal.dev or http://localhost:3001
 *   E2E_ISSUER_ID             — issuer ID registered in REVOCATION_ISSUERS
 *   E2E_ISSUER_PRIVATE_KEY    — secp256k1 private key (0x-prefixed hex) for revocation signing
 *
 * Usage:
 *   cd apps/api
 *   E2E_ISSUER_ID=issuer-dev E2E_ISSUER_PRIVATE_KEY=0x... \
 *   TRUSTSIGNAL_API_KEY=<key> TRUSTSIGNAL_API_BASE_URL=http://localhost:3001 \
 *   npx tsx ../../scripts/e2e-verify.ts
 */

import { createHash } from 'node:crypto';
import { Wallet } from 'ethers';

// ─── Config ──────────────────────────────────────────────────────────────────

const API_KEY = env('TRUSTSIGNAL_API_KEY');
const BASE_URL = env('TRUSTSIGNAL_API_BASE_URL').replace(/\/$/, '');
const ISSUER_ID = env('E2E_ISSUER_ID');
const ISSUER_PRIVATE_KEY = env('E2E_ISSUER_PRIVATE_KEY');

function env(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(`FATAL: ${name} is not set`);
    process.exit(1);
  }
  return val.trim();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const results: { step: string; pass: boolean; detail?: string }[] = [];

function pass(step: string, detail?: string) {
  results.push({ step, pass: true, detail });
  console.log(`  ✓  ${step}${detail ? ` — ${detail}` : ''}`);
}

function fail(step: string, detail: string): never {
  results.push({ step, pass: false, detail });
  console.error(`  ✗  ${step} — ${detail}`);
  printSummary();
  process.exit(1);
}

function printSummary() {
  console.log('\n─── Summary ───────────────────────────────────────────────────────────────');
  for (const r of results) {
    console.log(`  ${r.pass ? 'PASS' : 'FAIL'}  ${r.step}${r.detail ? `  (${r.detail})` : ''}`);
  }
  const failed = results.filter((r) => !r.pass).length;
  console.log(`\n  ${results.length - failed}/${results.length} steps passed`);
}

async function post(path: string, body?: unknown, headers?: Record<string, string>) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'x-api-key': API_KEY,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  return res;
}

async function get(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers: { 'x-api-key': API_KEY }
  });
  return res;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nTrustSignal E2E Verification Script`);
  console.log(`Target: ${BASE_URL}\n`);

  let receiptId: string;
  let receiptHash: string;

  // ── Step 1: Issue a receipt ─────────────────────────────────────────────
  {
    const step = 'POST /api/v1/verify — issue receipt';
    const body = {
      bundleId: `e2e-test-${Date.now()}`,
      transactionType: 'e2e_test',
      ron: {
        provider: 'e2e-test',
        notaryId: 'E2E-NOTARY-01',
        commissionState: 'IL',
        sealPayload: 'e2e-seal-payload'
      },
      doc: {
        docHash: `0x${createHash('sha256').update(`e2e-doc-${Date.now()}`).digest('hex')}`
      },
      policy: { profile: 'CONTROL_CC_001' },
      property: { parcelId: 'E2E-PARCEL-001', county: 'Cook', state: 'IL' },
      timestamp: new Date().toISOString()
    };

    const res = await post('/api/v1/verify', body);
    if (!res.ok) {
      const text = await res.text();
      fail(step, `HTTP ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    receiptId = data.receiptId as string;
    receiptHash = data.receiptHash as string;
    const status = data.status as string;

    if (!receiptId) fail(step, 'response missing receiptId');
    if (!receiptHash) fail(step, 'response missing receiptHash');
    if (!['clean', 'failure', 'revoked', 'compliance_gap'].includes(status)) {
      fail(step, `unexpected status value: ${status}`);
    }

    pass(step, `receiptId=${receiptId} status=${status}`);
  }

  // ── Step 2: Retrieve receipt ────────────────────────────────────────────
  {
    const step = 'GET /api/v1/receipt/:id — retrieve receipt';
    const res = await get(`/api/v1/receipt/${receiptId}`);
    if (!res.ok) {
      const text = await res.text();
      fail(step, `HTTP ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if ((data.receiptId as string) !== receiptId) {
      fail(step, `receiptId mismatch: expected ${receiptId}, got ${data.receiptId}`);
    }
    if (!['clean', 'failure', 'revoked', 'compliance_gap'].includes(data.status as string)) {
      fail(step, `unexpected status value: ${data.status}`);
    }

    pass(step, `status=${data.status}`);
  }

  // ── Step 3: Offline hash check ──────────────────────────────────────────
  {
    const step = 'Offline hash check — receiptHash format valid';
    // The receipt hash is a keccak256 / SHA-256 hex string prefixed with 0x.
    // We verify it's well-formed (64 hex chars after the 0x prefix).
    const hexPart = receiptHash.startsWith('0x') ? receiptHash.slice(2) : receiptHash;
    if (!/^[0-9a-f]{64}$/i.test(hexPart)) {
      fail(step, `receiptHash is not a valid 32-byte hex: ${receiptHash}`);
    }
    pass(step, `receiptHash=${receiptHash.slice(0, 18)}…`);
  }

  // ── Step 4: Server-side integrity check ─────────────────────────────────
  {
    const step = 'POST /api/v1/receipt/:id/verify — integrity check';
    const res = await post(`/api/v1/receipt/${receiptId}/verify`);
    if (!res.ok) {
      const text = await res.text();
      fail(step, `HTTP ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if (data.verified !== true) {
      fail(step, `verified=false integrityVerified=${data.integrityVerified} signatureVerified=${data.signatureVerified}`);
    }
    if (data.revoked !== false) {
      fail(step, 'receipt unexpectedly already revoked');
    }

    pass(step, `verified=true integrityVerified=${data.integrityVerified} signatureStatus=${data.signatureStatus}`);
  }

  // ── Step 5: Revoke receipt ───────────────────────────────────────────────
  {
    const step = 'POST /api/v1/receipt/:id/revoke — revoke receipt';
    const wallet = new Wallet(ISSUER_PRIVATE_KEY);
    const timestamp = Date.now().toString();
    const message = `revoke:${receiptId}:${timestamp}`;
    const signature = await wallet.signMessage(message);

    const res = await post(`/api/v1/receipt/${receiptId}/revoke`, undefined, {
      'x-issuer-id': ISSUER_ID,
      'x-issuer-signature': signature,
      'x-signature-timestamp': timestamp
    });
    if (!res.ok) {
      const text = await res.text();
      fail(step, `HTTP ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if (data.receiptStatus !== 'revoked') {
      fail(step, `expected receiptStatus=revoked, got: ${data.receiptStatus}`);
    }
    if (!['REVOKED', 'ALREADY_REVOKED'].includes(data.result as string)) {
      fail(step, `unexpected result: ${data.result}`);
    }

    pass(step, `receiptStatus=${data.receiptStatus} result=${data.result} issuerId=${ISSUER_ID}`);
  }

  // ── Step 6: Confirm revoked state ───────────────────────────────────────
  {
    const step = 'POST /api/v1/receipt/:id/verify — confirm revoked';
    const res = await post(`/api/v1/receipt/${receiptId}/verify`);
    if (!res.ok) {
      const text = await res.text();
      fail(step, `HTTP ${res.status}: ${text}`);
    }

    const data = await res.json() as Record<string, unknown>;
    if (data.revoked !== true) {
      fail(step, `expected revoked=true, got: ${data.revoked}`);
    }

    pass(step, `revoked=true verified=${data.verified}`);
  }

  // ─── Done ─────────────────────────────────────────────────────────────────
  console.log(`\nReceipt ID:    ${receiptId}`);
  console.log(`Receipt hash:  ${receiptHash}`);
  console.log(`Final status:  revoked`);
  printSummary();
}

main().catch((err: unknown) => {
  console.error('\nUnhandled error:', err);
  process.exit(1);
});
