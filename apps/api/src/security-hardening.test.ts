import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Buffer } from 'node:buffer';
import { FastifyInstance } from 'fastify';
import { Wallet } from 'ethers';

import { buildServer } from './server.js';
import { buildReceiptSigningConfig } from './security.js';

const apiKeyRead = 'test-read-key';
const apiKeyRate = 'test-rate-key';
const apiKeyVerify = 'test-verify-key';
const revocationSigner = Wallet.createRandom();

type EnvSnapshot = Record<string, string | undefined>;

const hasDatabaseUrl =
  Boolean(process.env.DATABASE_URL) ||
  Boolean(process.env.SUPABASE_DB_URL) ||
  Boolean(process.env.SUPABASE_POOLER_URL) ||
  Boolean(process.env.SUPABASE_DIRECT_URL);
const describeWithDatabase = hasDatabaseUrl ? describe.sequential : describe.skip;

function snapshotEnv(keys: string[]): EnvSnapshot {
  return Object.fromEntries(keys.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: EnvSnapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }
    process.env[key] = value;
  }
}

describeWithDatabase('Security hardening: auth, scopes, and per-key throttling', () => {
  let app: FastifyInstance;
  let envSnapshot: EnvSnapshot;

  beforeAll(async () => {
    const keysToSnapshot = [
      'API_KEYS',
      'API_KEY_SCOPES',
      'REVOCATION_ISSUERS',
      'RATE_LIMIT_API_KEY_MAX',
      'RATE_LIMIT_GLOBAL_MAX',
      'RATE_LIMIT_WINDOW',
      'CORS_ALLOWLIST'
    ];
    envSnapshot = snapshotEnv(keysToSnapshot);

    process.env.API_KEYS = `${apiKeyRead},${apiKeyRate},${apiKeyVerify}`;
    process.env.API_KEY_SCOPES = [
      `${apiKeyRead}=read`,
      `${apiKeyRate}=read`,
      `${apiKeyVerify}=verify|read|anchor|revoke`
    ].join(';');
    process.env.REVOCATION_ISSUERS = `issuer-a=${revocationSigner.address}`;
    process.env.RATE_LIMIT_API_KEY_MAX = '3';
    process.env.RATE_LIMIT_GLOBAL_MAX = '200';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    process.env.CORS_ALLOWLIST = 'https://portal.trustsignal.io';

    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(envSnapshot);
  });

  it('rejects missing or invalid API keys on protected routes', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts'
    });

    const invalid = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': 'invalid-key' }
    });

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(403);
  });

  it('enforces scope restrictions', async () => {
    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKeyRead },
      payload: {}
    });

    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error).toContain('missing scope');
  });

  it('exposes Vanta schema and structured verification payload', async () => {
    const schemaRes = await app.inject({
      method: 'GET',
      url: '/api/v1/integrations/vanta/schema',
      headers: { 'x-api-key': apiKeyRead }
    });

    expect(schemaRes.statusCode).toBe(200);
    expect(schemaRes.json().schemaVersion).toBe('trustsignal.vanta.verification_result.v1');

    const syntheticRes = await app.inject({
      method: 'GET',
      url: '/api/v1/synthetic',
      headers: { 'x-api-key': apiKeyVerify }
    });
    expect(syntheticRes.statusCode).toBe(200);
    const bundle = syntheticRes.json();
    bundle.doc.pdfBase64 = Buffer.from('%PDF-1.4\nsecurity-hardening', 'utf8').toString('base64');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKeyVerify },
      payload: bundle
    });
    expect(verifyRes.statusCode).toBe(200);

    const receiptId = verifyRes.json().receiptId as string;
    const vantaRes = await app.inject({
      method: 'GET',
      url: `/api/v1/integrations/vanta/verification/${receiptId}`,
      headers: { 'x-api-key': apiKeyRead }
    });

    expect(vantaRes.statusCode).toBe(200);
    const body = vantaRes.json();
    expect(body.schemaVersion).toBe('trustsignal.vanta.verification_result.v1');
    expect(body.vendor.name).toBe('TrustSignal');
    expect(body.subject.receiptId).toBe(receiptId);
    expect(['ALLOW', 'FLAG', 'BLOCK']).toContain(body.result.decision);
    expect(['PASS', 'REVIEW', 'FAIL']).toContain(body.result.normalizedStatus);
    expect(body.result.zkpAttestation?.status).toBe('dev-only');
    expect(body.result.zkpAttestation?.backend).toBe('halo2-dev');
    expect(body.result.zkpAttestation?.circuitId).toBe('document-sha256-v1');
    expect(typeof body.result.zkpAttestation?.publicInputs?.conformance).toBe('boolean');
    expect(body.result.zkpAttestation?.publicInputs?.documentWitnessMode).toBe('canonical-document-bytes-v1');
    expect(body.result.zkpAttestation?.publicInputs?.schemaVersion).toBe('trustsignal.document_sha256.v1');
    expect(typeof body.result.zkpAttestation?.publicInputs?.declaredDocHash).toBe('string');
    expect(typeof body.result.zkpAttestation?.publicInputs?.documentDigest).toBe('string');
    expect(typeof body.result.zkpAttestation?.publicInputs?.documentCommitment).toBe('string');
    expect(typeof body.result.zkpAttestation?.proofArtifact?.digest).toBe('string');
    expect(body.result.zkpAttestation?.verificationKeyId).toBeUndefined();
    expect(body.result.zkpAttestation?.verifiedAt).toBeUndefined();
    expect(body.result.zkpAttestation?.proofArtifact?.encoding).toBeUndefined();
    expect(body.result.zkpAttestation?.proofArtifact?.proof).toBeUndefined();
    expect(body.controls.anchored).toBe(false);
    expect(body.controls.receiptSignaturePresent).toBe(true);
    expect(body.controls.receiptSignatureAlg).toBe('EdDSA');
    expect(typeof body.controls.receiptSignatureKid).toBe('string');
    expect(typeof body.controls.anchorSubjectDigest).toBe('string');
    expect(body.controls.anchorSubjectVersion).toBe('trustsignal.anchor_subject.v1');
  });

  it('enforces per-api-key rate limiting', async () => {
    const first = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': apiKeyRate }
    });
    const second = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': apiKeyRate }
    });
    const third = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': apiKeyRate }
    });
    const fourth = await app.inject({
      method: 'GET',
      url: '/api/v1/receipts',
      headers: { 'x-api-key': apiKeyRate }
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(200);
    expect(fourth.statusCode).toBe(429);
  });

  it('applies CORS allowlist from environment', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'https://portal.trustsignal.io',
        'access-control-request-method': 'GET'
      }
    });

    const blocked = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: {
        origin: 'https://evil.example',
        'access-control-request-method': 'GET'
      }
    });

    expect(allowed.headers['access-control-allow-origin']).toBe('https://portal.trustsignal.io');
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('requires issuer signature headers for revoke and verifies signature', async () => {
    const syntheticRes = await app.inject({
      method: 'GET',
      url: '/api/v1/synthetic',
      headers: { 'x-api-key': apiKeyVerify }
    });
    const bundle = syntheticRes.json();
    bundle.doc.pdfBase64 = Buffer.from('%PDF-1.4\nrevocation-test', 'utf8').toString('base64');

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKeyVerify },
      payload: bundle
    });

    expect(verifyRes.statusCode).toBe(200);
    const receiptId = verifyRes.json().receiptId as string;

    const missingHeaders = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receiptId}/revoke`,
      headers: { 'x-api-key': apiKeyVerify }
    });
    expect(missingHeaders.statusCode).toBe(401);

    const timestamp = Date.now().toString();
    const validMessage = `revoke:${receiptId}:${timestamp}`;
    const validSignature = await revocationSigner.signMessage(validMessage);

    const badSignature = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receiptId}/revoke`,
      headers: {
        'x-api-key': apiKeyVerify,
        'x-issuer-id': 'issuer-a',
        'x-signature-timestamp': timestamp,
        'x-issuer-signature': `${validSignature}00`
      }
    });
    expect(badSignature.statusCode).toBe(401);

    const valid = await app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${receiptId}/revoke`,
      headers: {
        'x-api-key': apiKeyVerify,
        'x-issuer-id': 'issuer-a',
        'x-signature-timestamp': timestamp,
        'x-issuer-signature': validSignature
      }
    });

    expect(valid.statusCode).toBe(200);
    expect(valid.json().status).toBe('REVOKED');
    expect(valid.json().issuerId).toBe('issuer-a');
  });
});

describe.sequential('Security hardening: global rate limiting', () => {
  let app: FastifyInstance;
  let envSnapshot: EnvSnapshot;

  beforeAll(async () => {
    const keysToSnapshot = ['RATE_LIMIT_GLOBAL_MAX', 'RATE_LIMIT_API_KEY_MAX', 'RATE_LIMIT_WINDOW', 'API_KEYS'];
    envSnapshot = snapshotEnv(keysToSnapshot);

    process.env.RATE_LIMIT_GLOBAL_MAX = '2';
    process.env.RATE_LIMIT_API_KEY_MAX = '50';
    process.env.RATE_LIMIT_WINDOW = '1 minute';
    process.env.API_KEYS = apiKeyRead;

    app = await buildServer();
  });

  afterAll(async () => {
    await app.close();
    restoreEnv(envSnapshot);
  });

  it('limits all traffic globally by IP', async () => {
    const first = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const second = await app.inject({ method: 'GET', url: '/api/v1/health' });
    const third = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
  });
});

describe.sequential('Security hardening: production verifier configuration', () => {
  let envSnapshot: EnvSnapshot;

  beforeAll(() => {
    const keysToSnapshot = ['NODE_ENV', 'NOTARY_API_KEY', 'PROPERTY_API_KEY', 'TRUST_REGISTRY_SOURCE'];
    envSnapshot = snapshotEnv(keysToSnapshot);
    process.env.NODE_ENV = 'production';
    delete process.env.NOTARY_API_KEY;
    delete process.env.PROPERTY_API_KEY;
    delete process.env.TRUST_REGISTRY_SOURCE;
  });

  afterAll(() => {
    restoreEnv(envSnapshot);
  });

  it('fails fast if required verifier env vars are missing', async () => {
    await expect(buildServer()).rejects.toThrow('Missing required production env vars');
  });
});

describe.sequential('Security hardening: production receipt-signing configuration', () => {
  let envSnapshot: EnvSnapshot;

  beforeAll(() => {
    const keysToSnapshot = [
      'NODE_ENV',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK',
      'TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS',
      'TRUSTSIGNAL_RECEIPT_SIGNING_KID'
    ];
    envSnapshot = snapshotEnv(keysToSnapshot);
    process.env.NODE_ENV = 'production';
    delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PRIVATE_JWK;
    delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWK;
    delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_PUBLIC_JWKS;
    delete process.env.TRUSTSIGNAL_RECEIPT_SIGNING_KID;
  });

  afterAll(() => {
    restoreEnv(envSnapshot);
  });

  it('fails fast if receipt-signing env vars are missing', () => {
    expect(() => buildReceiptSigningConfig(process.env)).toThrow(
      'Missing required production receipt-signing env vars'
    );
  });
});
