import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { setTimeout as delay } from 'node:timers/promises';

import { PrismaClient } from '@prisma/client';

import { buildServer } from '../apps/api/src/server.js';
import { loadRegistry } from '../apps/api/src/registryLoader.js';
import { deriveNotaryWallet, signDocHash } from '../packages/core/src/index.js';
import type { BundleInput, TrustRegistry } from '../packages/core/src/types.js';

type VerifyResponse = {
  decision: string;
  reasons: string[];
  receiptId: string;
  receiptHash: string;
  receiptSignature?: {
    signature: string;
    alg: string;
    kid: string;
  };
  zkpAttestation?: {
    status?: string;
    backend?: string;
    publicInputs?: {
      declaredDocHash?: string;
      documentDigest?: string;
      documentCommitment?: string;
      documentWitnessMode?: string;
    };
  };
};

type ReceiptVerifyResponse = {
  verified: boolean;
  integrityVerified: boolean;
  signatureVerified: boolean;
  signatureStatus: string;
  proofVerified: boolean;
};

const apiKey = 'demo-key';

function sha256Hex(input: Buffer): string {
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}

function shortHash(value: string | undefined, head = 14): string {
  if (!value) return 'n/a';
  return value.length <= head ? value : `${value.slice(0, head)}...`;
}

function divider(label?: string) {
  const line = '============================================================';
  console.log(label ? `${line}\n${label}\n${line}` : line);
}

async function note(text: string, ms = 650) {
  console.log(text);
  await delay(ms);
}

function renderArtifact(lines: string[]): Buffer {
  return Buffer.from(lines.join('\n'), 'utf8');
}

async function withMutedApiNoise<T>(fn: () => Promise<T>): Promise<T> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalStdoutWrite = process.stdout.write.bind(process.stdout);
  const originalStderrWrite = process.stderr.write.bind(process.stderr);
  const shouldSuppress = (text: string) =>
    text.startsWith('[DatabaseCountyVerifier]') ||
    text.startsWith('[CookCountyComplianceValidator]') ||
    text.startsWith('Error:') ||
    text.startsWith('(while reading XRef)') ||
    text.includes('Invalid XRef stream header');
  console.log = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (shouldSuppress(first)) {
      return;
    }
    originalLog(...args);
  };
  console.error = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (shouldSuppress(first)) {
      return;
    }
    originalError(...args);
  };
  console.warn = (...args: unknown[]) => {
    const first = String(args[0] ?? '');
    if (shouldSuppress(first)) {
      return;
    }
    originalWarn(...args);
  };
  process.stdout.write = ((chunk: any, encoding?: any, cb?: any) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : undefined);
    if (shouldSuppress(text.trim())) {
      if (typeof cb === 'function') cb();
      return true;
    }
    return originalStdoutWrite(chunk, encoding, cb);
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: any, encoding?: any, cb?: any) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString(typeof encoding === 'string' ? encoding : undefined);
    if (shouldSuppress(text.trim())) {
      if (typeof cb === 'function') cb();
      return true;
    }
    return originalStderrWrite(chunk, encoding, cb);
  }) as typeof process.stderr.write;

  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    process.stdout.write = originalStdoutWrite as typeof process.stdout.write;
    process.stderr.write = originalStderrWrite as typeof process.stderr.write;
  }
}

async function buildBundle(
  registry: TrustRegistry,
  artifactBuffer: Buffer,
  options: {
    includePdfBase64: boolean;
    bundleId: string;
  }
): Promise<BundleInput> {
  const notary = registry.notaries[0];
  const provider = registry.ronProviders.find((entry) => entry.status === 'ACTIVE') || registry.ronProviders[0];
  if (!notary || !provider) {
    throw new Error('registry_missing_notary_or_provider');
  }

  const docHash = sha256Hex(artifactBuffer);
  const sealPayload = await signDocHash(deriveNotaryWallet(notary.id), docHash);

  return {
    bundleId: options.bundleId,
    transactionType: 'warranty',
    ron: {
      provider: provider.id,
      notaryId: notary.id,
      commissionState: notary.commissionState,
      sealPayload,
      sealScheme: 'SIM-ECDSA-v1'
    },
    doc: {
      docHash,
      ...(options.includePdfBase64 ? { pdfBase64: artifactBuffer.toString('base64') } : {})
    },
    property: {
      parcelId: 'DEMO-PARCEL-001',
      county: 'Demo County',
      state: notary.commissionState
    },
    policy: {
      profile: `STANDARD_${notary.commissionState}`
    },
    timestamp: '2026-03-08T12:00:00.000Z'
  };
}

async function main() {
  process.env.OPENAI_API_KEY = '';
  process.env.API_KEYS = apiKey;
  process.env.API_KEY_SCOPES = `${apiKey}=verify|read|anchor|revoke`;

  const prisma = new PrismaClient();
  const app = await buildServer();
  app.log.level = 'fatal';

  try {
    const registry = await loadRegistry();

    await prisma.countyRecord.upsert({
      where: { parcelId: 'DEMO-PARCEL-001' },
      update: { county: 'Demo County', state: registry.notaries[0]?.commissionState || 'CA', active: true },
      create: {
        parcelId: 'DEMO-PARCEL-001',
        county: 'Demo County',
        state: registry.notaries[0]?.commissionState || 'CA',
        active: true
      }
    });

    const validArtifact = renderArtifact([
      'Prepared By: TrustSignal Demo Team',
      'Mail To: Partner Integration Review',
      'Property Address: 100 Integrity Way, Demo City',
      'Legal Description: Lot 1, Block A, TrustSignal Industrial Park',
      'Narrative: this document is the baseline artifact for receipt issuance.'
    ]);
    const tamperedArtifact = renderArtifact([
      'Prepared By: TrustSignal Demo Team',
      'Mail To: Partner Integration Review',
      'Property Address: 999 Changed Address, Demo City',
      'Legal Description: Lot 9, Block Z, Modified After Submission',
      'Narrative: these bytes were changed after the original declared hash was created.'
    ]);

    const validBundle = await buildBundle(registry, validArtifact, {
      includePdfBase64: false,
      bundleId: 'DEMO-BUNDLE-001'
    });
    const tamperedBundle: BundleInput = {
      ...(await buildBundle(registry, tamperedArtifact, {
        includePdfBase64: true,
        bundleId: 'DEMO-BUNDLE-001-TAMPERED'
      })),
      doc: {
        docHash: validBundle.doc.docHash,
        pdfBase64: tamperedArtifact.toString('base64')
      }
    };

    divider('TrustSignal Terminal Demo');
    await note('TrustSignal is being shown here as backend evidence-integrity infrastructure.');
    await note('The operator sends an artifact once, TrustSignal issues a signed receipt, and later verification proves the receipt has not been altered.');
    await note('This demo does not claim production-grade blockchain or ZK enforcement. It shows the receipt and evidence chain that exist in code today.');
    await note('For deterministic output, AI-based document compliance checks are intentionally not part of this walkthrough.');

    divider('Flow 1: Valid Artifact Intake');
    await note('Step 1: Submit a baseline artifact with a stable declared digest and issue a signed integrity receipt.');
    const validIssueRes = await withMutedApiNoise(() => app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKey },
      payload: validBundle
    }));
    if (validIssueRes.statusCode !== 200) {
      throw new Error(`valid_issue_failed:${validIssueRes.statusCode}:${validIssueRes.body}`);
    }
    const validReceipt = validIssueRes.json<VerifyResponse>();
    const validGetRes = await withMutedApiNoise(() => app.inject({
      method: 'GET',
      url: `/api/v1/receipt/${validReceipt.receiptId}`,
      headers: { 'x-api-key': apiKey }
    }));
    const validVerifyRes = await withMutedApiNoise(() => app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${validReceipt.receiptId}/verify`,
      headers: { 'x-api-key': apiKey }
    }));
    const validVerification = validVerifyRes.json<ReceiptVerifyResponse>();
    const validPublicInputs = validReceipt.zkpAttestation?.publicInputs;
    const validArtifactMatch = validPublicInputs?.declaredDocHash === validPublicInputs?.documentDigest;

    console.log(`Receipt ID:        ${validReceipt.receiptId}`);
    console.log(`Receipt Hash:      ${validReceipt.receiptHash}`);
    console.log(`Signature Alg:     ${validReceipt.receiptSignature?.alg ?? 'missing'}`);
    console.log(`Signature Kid:     ${validReceipt.receiptSignature?.kid ?? 'missing'}`);
    console.log(`Signature Status:  ${validVerification.signatureStatus}`);
    console.log(`Integrity Result:  ${validVerification.integrityVerified ? 'verified' : 'failed'}`);
    console.log(`Receipt Verify:    ${validVerification.verified ? 'verified' : 'failed'}`);
    console.log(`Artifact Match:    ${validArtifactMatch ? 'declared hash matches received bytes' : 'declared digest recorded for issuance'}`);
    console.log(`Receipt Fetch:     ${validGetRes.statusCode === 200 ? 'persisted and retrievable' : 'fetch failed'}`);

    await note('Narration: the receipt is signed, persisted, and later verification confirms the stored receipt has not been modified.');
    await note('Narration: this baseline flow shows low-friction intake. The artifact is accepted, a receipt is attached, and later receipt verification succeeds.');
    await note(`Narration: any separate policy decision remains distinct from this integrity story. Current API decision for this sample: ${validReceipt.decision}.`);

    divider('Flow 2: Tampered Artifact Intake');
    await note('Step 2: Reuse the original declared hash and notary seal, but change the artifact bytes before submission.');
    const tamperedIssueRes = await withMutedApiNoise(() => app.inject({
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': apiKey },
      payload: tamperedBundle
    }));
    if (tamperedIssueRes.statusCode !== 200) {
      throw new Error(`tampered_issue_failed:${tamperedIssueRes.statusCode}:${tamperedIssueRes.body}`);
    }
    const tamperedReceipt = tamperedIssueRes.json<VerifyResponse>();
    const tamperedVerifyRes = await withMutedApiNoise(() => app.inject({
      method: 'POST',
      url: `/api/v1/receipt/${tamperedReceipt.receiptId}/verify`,
      headers: { 'x-api-key': apiKey }
    }));
    const tamperedVerification = tamperedVerifyRes.json<ReceiptVerifyResponse>();
    const tamperedPublicInputs = tamperedReceipt.zkpAttestation?.publicInputs;
    const tamperedArtifactMatch = tamperedPublicInputs?.declaredDocHash === tamperedPublicInputs?.documentDigest;

    console.log(`Receipt ID:        ${tamperedReceipt.receiptId}`);
    console.log(`Receipt Hash:      ${tamperedReceipt.receiptHash}`);
    console.log(`Signature Status:  ${tamperedVerification.signatureStatus}`);
    console.log(`Integrity Result:  ${tamperedVerification.integrityVerified ? 'verified' : 'failed'}`);
    console.log(`Receipt Verify:    ${tamperedVerification.verified ? 'verified' : 'failed'}`);
    console.log(`Declared Hash:     ${shortHash(tamperedPublicInputs?.declaredDocHash, 18)}`);
    console.log(`Observed Digest:   ${shortHash(tamperedPublicInputs?.documentDigest, 18)}`);
    console.log(`Artifact Match:    ${tamperedArtifactMatch ? 'declared hash matches received bytes' : 'mismatch detected'}`);
    console.log(`Witness Mode:      ${tamperedPublicInputs?.documentWitnessMode ?? 'unknown'}`);
    console.log(`Proof Status:      ${tamperedReceipt.zkpAttestation?.status ?? 'unknown'}`);

    await note('Narration: the receipt still verifies as a receipt because TrustSignal is checking that the receipt itself was not changed after issuance.');
    await note('Narration: the tamper signal appears in the receipt evidence, where the declared hash and the observed document digest diverge.');
    await note('Narration: this is the integration story for partners. The artifact enters once, the signed receipt attaches, and later verification shows whether the recorded evidence is still intact.');

    divider('Operator Summary');
    console.log(`Valid Flow Final Result:     ${validVerification.verified ? 'receipt verified' : 'verification failed'}`);
    console.log(`Tampered Flow Final Result:  ${tamperedArtifactMatch ? 'no mismatch recorded' : 'tamper-evident mismatch recorded'}`);
    console.log(`Receipt Signature Metadata:  ${validReceipt.receiptSignature?.alg ?? 'missing'} / ${validReceipt.receiptSignature?.kid ?? 'missing'}`);
    console.log('Implementation Truth: receipt signing and receipt verification are real; dev-only ZKP remains dev-only in this demo.');
  } finally {
    await app.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
