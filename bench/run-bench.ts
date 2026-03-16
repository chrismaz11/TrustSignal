import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFile as execFileCallback, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';

import { PrismaClient } from '@prisma/client';
import type { FastifyInstance } from 'fastify';

import { loadRegistry } from '../apps/api/src/registryLoader.js';
import { buildSecurityConfig } from '../apps/api/src/security.js';
import { deriveNotaryWallet, signDocHash } from '../packages/core/src/synthetic.js';
import { buildReceipt, toUnsignedReceiptPayload } from '../packages/core/src/receipt.js';
import { signReceiptPayload } from '../packages/core/src/receiptSigner.js';
import type { BundleInput, Receipt, TrustRegistry, VerificationResult } from '../packages/core/src/types.js';

const execFile = promisify(execFileCallback);

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const RESULTS_DIR = path.join(ROOT, 'bench', 'results');
const FIXTURES_DIR = path.join(ROOT, 'bench', 'fixtures');
const DEFAULT_API_KEY = 'bench-api-key';
const DEFAULT_SCENARIO = 'all';
const DEFAULT_RUNS = 15;
const DEFAULT_BATCH_SIZE = 10;

type ScenarioName =
  | 'clean'
  | 'tampered'
  | 'repeat'
  | 'lookup'
  | 'later-verification'
  | 'bad-auth'
  | 'malformed'
  | 'dependency-failure'
  | 'batch';

type CliOptions = {
  scenario: ScenarioName | 'all';
  runs: number;
  batchSize: number;
  outputDir: string;
};

type TempPostgres = {
  databaseUrl: string;
  tmpDir: string;
  pgData: string;
  port: number;
  dbName: string;
  user: string;
  started: boolean;
};

type TimingSummary = {
  count: number;
  minMs: number;
  maxMs: number;
  meanMs: number;
  medianMs: number;
  p95Ms: number;
};

type RawScenarioResult = {
  scenario: ScenarioName;
  purpose: string;
  command: string;
  metricsCaptured: string[];
  expectedOutcome: string;
  timingsMs: number[];
  statusCodes: number[];
  successCount: number;
  failureCount: number;
  reliabilityNotes: string[];
  caveats: string[];
  extra?: Record<string, unknown>;
};

type AggregatedScenarioResult = RawScenarioResult & {
  summary: TimingSummary;
};

type BenchmarkOutput = {
  generatedAt: string;
  command: string;
  environment: {
    node: string;
    platform: string;
    arch: string;
    hostname: string;
    tempDatabase: {
      engine: string;
      port: number;
      dbName: string;
    };
    notes: string[];
  };
  harness: {
    scenario: string;
    runs: number;
    batchSize: number;
    sampleNotes: string[];
  };
  metrics: {
    verificationRequestLatency: TimingSummary | null;
    signedReceiptGenerationLatency: TimingSummary | null;
    laterVerificationLatency: TimingSummary | null;
    statusLookupLatency: TimingSummary | null;
    tamperedArtifactDetectionLatency: TimingSummary | null;
    repeatedRunStability: TimingSummary | null;
  };
  scenarios: AggregatedScenarioResult[];
  notableFailures: string[];
  caveats: string[];
};

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
    publicInputs?: {
      declaredDocHash?: string;
      documentDigest?: string;
    };
  };
};

type ReceiptDetailResponse = VerifyResponse & {
  receipt: Receipt;
};

type StatusResponse = {
  verified: boolean;
  integrityVerified: boolean;
  signatureVerified: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    scenario: DEFAULT_SCENARIO,
    runs: DEFAULT_RUNS,
    batchSize: DEFAULT_BATCH_SIZE,
    outputDir: RESULTS_DIR
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--scenario' && next) {
      options.scenario = next as CliOptions['scenario'];
      index += 1;
      continue;
    }

    if (arg === '--runs' && next) {
      options.runs = Math.max(1, Number.parseInt(next, 10) || DEFAULT_RUNS);
      index += 1;
      continue;
    }

    if (arg === '--batch-size' && next) {
      options.batchSize = Math.max(1, Number.parseInt(next, 10) || DEFAULT_BATCH_SIZE);
      index += 1;
      continue;
    }

    if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(ROOT, next);
      index += 1;
    }
  }

  return options;
}

function sha256Hex(input: Buffer): string {
  return `0x${createHash('sha256').update(input).digest('hex')}`;
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function summarizeTimings(values: number[]): TimingSummary {
  const sorted = [...values].sort((left, right) => left - right);
  const count = sorted.length;
  const meanMs = sorted.reduce((sum, value) => sum + value, 0) / count;
  const medianIndex = Math.floor(count / 2);
  const medianMs =
    count % 2 === 0
      ? (sorted[medianIndex - 1] + sorted[medianIndex]) / 2
      : sorted[medianIndex];
  const p95Index = Math.max(0, Math.ceil(count * 0.95) - 1);

  return {
    count,
    minMs: round(sorted[0]),
    maxMs: round(sorted[count - 1]),
    meanMs: round(meanMs),
    medianMs: round(medianMs),
    p95Ms: round(sorted[p95Index])
  };
}

async function ensureBenchDirectories(outputDir: string) {
  await fs.mkdir(outputDir, { recursive: true });
}

async function requireCommand(command: string) {
  await execFile('sh', ['-lc', `command -v ${command}`], { cwd: ROOT });
}

async function detectFreePort(): Promise<number> {
  const { stdout } = await execFile('node', [
    '-e',
    "const net=require('node:net');const server=net.createServer();server.listen(0,'127.0.0.1',()=>{console.log(server.address().port);server.close();});"
  ], { cwd: ROOT });
  return Number.parseInt(stdout.trim(), 10);
}

async function startTemporaryPostgres(): Promise<TempPostgres> {
  for (const command of ['initdb', 'pg_ctl', 'createdb', 'psql']) {
    await requireCommand(command);
  }

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'trustsignal-bench-'));
  const port = await detectFreePort();
  const user = os.userInfo().username;
  const dbName = 'trustsignal_bench';
  const pgData = path.join(tmpDir, 'pgdata');
  const pgLog = path.join(tmpDir, 'postgres.log');
  const databaseUrl = `postgresql://${user}@127.0.0.1:${port}/${dbName}?sslmode=disable`;

  await execFile('initdb', ['-D', pgData, '-A', 'trust', '-U', user], { cwd: ROOT });
  await execFile('pg_ctl', ['-D', pgData, '-l', pgLog, '-o', `-h 127.0.0.1 -p ${port}`, 'start'], {
    cwd: ROOT
  });
  await execFile('createdb', ['-h', '127.0.0.1', '-p', String(port), '-U', user, dbName], { cwd: ROOT });
  await execFile('psql', [databaseUrl, '-Atc', 'select current_database(), current_user;'], { cwd: ROOT });

  return {
    databaseUrl,
    tmpDir,
    pgData,
    port,
    dbName,
    user,
    started: true
  };
}

async function stopTemporaryPostgres(pg: TempPostgres | null) {
  if (!pg) return;

  try {
    if (pg.started) {
      await execFile('pg_ctl', ['-D', pg.pgData, 'stop', '-m', 'fast'], { cwd: ROOT });
    }
  } catch {
    // ignore cleanup failures
  }

  await fs.rm(pg.tmpDir, { recursive: true, force: true });
}

async function withMeasuredInject<T>(
  app: FastifyInstance,
  request: Parameters<FastifyInstance['inject']>[0],
  parse: (payload: string) => T
): Promise<{ elapsedMs: number; statusCode: number; body: T }> {
  const started = performance.now();
  const response = await app.inject(request);
  const elapsedMs = performance.now() - started;
  return {
    elapsedMs: round(elapsedMs),
    statusCode: response.statusCode,
    body: parse(response.body)
  };
}

async function loadFixtureText(fileName: string): Promise<Buffer> {
  return fs.readFile(path.join(FIXTURES_DIR, fileName));
}

async function buildBundle(
  registry: TrustRegistry,
  artifactBuffer: Buffer,
  options: {
    bundleId: string;
    parcelId: string;
    declaredDocHash?: string;
    includePdfBase64?: boolean;
  }
): Promise<BundleInput> {
  const notary = registry.notaries[0];
  const provider = registry.ronProviders.find((entry) => entry.status === 'ACTIVE') || registry.ronProviders[0];
  if (!notary || !provider) {
    throw new Error('registry_missing_notary_or_provider');
  }

  const declaredDocHash = options.declaredDocHash || sha256Hex(artifactBuffer);
  const sealPayload = await signDocHash(deriveNotaryWallet(notary.id), declaredDocHash);

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
      docHash: declaredDocHash,
      ...(options.includePdfBase64 === false
        ? {}
        : { pdfBase64: artifactBuffer.toString('base64') })
    },
    property: {
      parcelId: options.parcelId,
      county: 'Demo County',
      state: notary.commissionState
    },
    policy: {
      profile: `STANDARD_${notary.commissionState}`
    },
    timestamp: '2026-03-12T12:00:00.000Z'
  };
}

async function seedBaselineData(prisma: PrismaClient, registry: TrustRegistry) {
  const notary = registry.notaries[0];
  if (!notary) {
    throw new Error('registry_has_no_notaries');
  }

  await prisma.countyRecord.upsert({
    where: { parcelId: 'BENCH-PARCEL-001' },
    update: { county: 'Demo County', state: notary.commissionState, active: true },
    create: {
      parcelId: 'BENCH-PARCEL-001',
      county: 'Demo County',
      state: notary.commissionState,
      active: true
    }
  });

  await prisma.countyRecord.upsert({
    where: { parcelId: 'BENCH-PARCEL-002' },
    update: { county: 'Demo County', state: notary.commissionState, active: true },
    create: {
      parcelId: 'BENCH-PARCEL-002',
      county: 'Demo County',
      state: notary.commissionState,
      active: true
    }
  });
}

async function scenarioClean(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string,
  runs: number
): Promise<{ scenario: RawScenarioResult; signingTimings: number[] }> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];
  const signingTimings: number[] = [];
  const reliabilityNotes: string[] = [];
  const caveats: string[] = [];
  let successCount = 0;
  let failureCount = 0;

  const securityConfig = buildSecurityConfig();

  for (let index = 0; index < runs; index += 1) {
    const bundle = { ...cleanBundle, bundleId: `BENCH-CLEAN-${index + 1}` };
    const verify = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': DEFAULT_API_KEY },
        payload: bundle
      },
      (payload) => JSON.parse(payload) as VerifyResponse
    );

    timingsMs.push(verify.elapsedMs);
    statusCodes.push(verify.statusCode);

    if (verify.statusCode === 200 && verify.body.receiptId && verify.body.receiptSignature) {
      successCount += 1;

      const detail = await withMeasuredInject(
        app,
        {
          method: 'GET',
          url: `/api/v1/receipt/${verify.body.receiptId}`,
          headers: { 'x-api-key': DEFAULT_API_KEY }
        },
        (payload) => JSON.parse(payload) as ReceiptDetailResponse
      );

      const receipt = detail.body.receipt;
      const verificationLike: VerificationResult = {
        decision: receipt.decision,
        reasons: receipt.reasons,
        riskScore: receipt.riskScore,
        checks: receipt.checks
      };
      const started = performance.now();
      const rebuiltReceipt = buildReceipt(bundle, verificationLike, 'deed-shield', {
        fraudRisk: receipt.fraudRisk,
        zkpAttestation: receipt.zkpAttestation
      });
      await signReceiptPayload(
        toUnsignedReceiptPayload(rebuiltReceipt),
        securityConfig.receiptSigning.current
      );
      signingTimings.push(round(performance.now() - started));
    } else {
      failureCount += 1;
    }
  }

  if (failureCount > 0) {
    caveats.push('One or more clean verification runs did not return HTTP 200 with a signed receipt.');
  }
  reliabilityNotes.push(`${successCount}/${runs} clean verification requests returned signed receipts.`);

  return {
    scenario: {
      scenario: 'clean',
      purpose: 'Measure end-to-end clean artifact verification through POST /api/v1/verify.',
      command: `${securityCommandBase} --scenario clean --runs ${runs}`,
      metricsCaptured: ['verification request latency', 'signed receipt generation latency'],
      expectedOutcome: 'HTTP 200 with receiptId, receiptHash, and receiptSignature present.',
      timingsMs,
      statusCodes,
      successCount,
      failureCount,
      reliabilityNotes,
      caveats
    },
    signingTimings
  };
}

async function scenarioLookup(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string,
  runs: number
): Promise<{
  lookup: RawScenarioResult;
  laterVerification: RawScenarioResult;
}> {
  const lookupTimingsMs: number[] = [];
  const verifyTimingsMs: number[] = [];
  const lookupStatusCodes: number[] = [];
  const verifyStatusCodes: number[] = [];
  let lookupSuccess = 0;
  let verifySuccess = 0;

  for (let index = 0; index < runs; index += 1) {
    const verifyIssue = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': DEFAULT_API_KEY },
        payload: { ...cleanBundle, bundleId: `BENCH-LOOKUP-${index + 1}` }
      },
      (payload) => JSON.parse(payload) as VerifyResponse
    );

    if (verifyIssue.statusCode !== 200 || !verifyIssue.body.receiptId) {
      lookupStatusCodes.push(verifyIssue.statusCode);
      verifyStatusCodes.push(verifyIssue.statusCode);
      continue;
    }

    const receiptId = verifyIssue.body.receiptId;
    const lookup = await withMeasuredInject(
      app,
      {
        method: 'GET',
        url: `/api/v1/receipt/${receiptId}`,
        headers: { 'x-api-key': DEFAULT_API_KEY }
      },
      (payload) => JSON.parse(payload) as ReceiptDetailResponse
    );
    lookupTimingsMs.push(lookup.elapsedMs);
    lookupStatusCodes.push(lookup.statusCode);
    if (lookup.statusCode === 200 && lookup.body.receipt?.receiptId === receiptId) {
      lookupSuccess += 1;
    }

    const laterVerification = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: `/api/v1/receipt/${receiptId}/verify`,
        headers: { 'x-api-key': DEFAULT_API_KEY }
      },
      (payload) => JSON.parse(payload) as StatusResponse
    );
    verifyTimingsMs.push(laterVerification.elapsedMs);
    verifyStatusCodes.push(laterVerification.statusCode);
    if (laterVerification.statusCode === 200 && laterVerification.body.verified) {
      verifySuccess += 1;
    }
  }

  return {
    lookup: {
      scenario: 'lookup',
      purpose: 'Measure receipt retrieval latency through GET /api/v1/receipt/:receiptId.',
      command: `${securityCommandBase} --scenario lookup --runs ${runs}`,
      metricsCaptured: ['status lookup latency'],
      expectedOutcome: 'HTTP 200 with persisted receipt payload.',
      timingsMs: lookupTimingsMs,
      statusCodes: lookupStatusCodes,
      successCount: lookupSuccess,
      failureCount: Math.max(0, runs - lookupSuccess),
      reliabilityNotes: [`${lookupSuccess}/${runs} receipt lookup requests returned the stored receipt.`],
      caveats: lookupSuccess === runs ? [] : ['Some lookup requests did not return the expected receipt payload.']
    },
    laterVerification: {
      scenario: 'later-verification',
      purpose: 'Measure later verification latency through POST /api/v1/receipt/:receiptId/verify.',
      command: `${securityCommandBase} --scenario lookup --runs ${runs}`,
      metricsCaptured: ['later verification latency'],
      expectedOutcome: 'HTTP 200 with verified=true, integrityVerified=true, and signatureVerified=true.',
      timingsMs: verifyTimingsMs,
      statusCodes: verifyStatusCodes,
      successCount: verifySuccess,
      failureCount: Math.max(0, runs - verifySuccess),
      reliabilityNotes: [`${verifySuccess}/${runs} later verification requests returned verified=true.`],
      caveats: verifySuccess === runs ? [] : ['Some later verification requests did not return verified=true.']
    }
  };
}

async function scenarioTampered(
  app: FastifyInstance,
  tamperedBundle: BundleInput,
  securityCommandBase: string,
  runs: number
): Promise<RawScenarioResult> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];
  const reliabilityNotes: string[] = [];
  const caveats: string[] = [];
  let mismatchDetected = 0;

  for (let index = 0; index < runs; index += 1) {
    const verify = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': DEFAULT_API_KEY },
        payload: { ...tamperedBundle, bundleId: `BENCH-TAMPER-${index + 1}` }
      },
      (payload) => JSON.parse(payload) as VerifyResponse
    );

    timingsMs.push(verify.elapsedMs);
    statusCodes.push(verify.statusCode);

    const publicInputs = verify.body.zkpAttestation?.publicInputs;
    if (
      verify.statusCode === 200 &&
      publicInputs?.declaredDocHash &&
      publicInputs.documentDigest &&
      publicInputs.declaredDocHash !== publicInputs.documentDigest
    ) {
      mismatchDetected += 1;
    }
  }

  reliabilityNotes.push(`${mismatchDetected}/${runs} tampered runs surfaced a declared hash vs observed digest mismatch.`);
  if (mismatchDetected !== runs) {
    caveats.push('Not every tampered run surfaced the expected digest mismatch signal.');
  }

  return {
    scenario: 'tampered',
    purpose: 'Measure latency for a tampered artifact submission where the declared hash does not match the supplied bytes.',
    command: `${securityCommandBase} --scenario tampered --runs ${runs}`,
    metricsCaptured: ['tampered artifact detection latency'],
    expectedOutcome: 'HTTP 200 with mismatch visible in zkpAttestation.publicInputs declaredDocHash vs documentDigest.',
    timingsMs,
    statusCodes,
    successCount: mismatchDetected,
    failureCount: Math.max(0, runs - mismatchDetected),
    reliabilityNotes,
    caveats
  };
}

async function scenarioRepeat(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string,
  runs: number
): Promise<RawScenarioResult> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];
  let successCount = 0;

  const repeatBundle = { ...cleanBundle, bundleId: 'BENCH-REPEAT-SAME' };

  for (let index = 0; index < runs; index += 1) {
    const response = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': DEFAULT_API_KEY },
        payload: repeatBundle
      },
      (payload) => JSON.parse(payload) as VerifyResponse
    );

    timingsMs.push(response.elapsedMs);
    statusCodes.push(response.statusCode);
    if (response.statusCode === 200 && response.body.receiptId) {
      successCount += 1;
    }
  }

  return {
    scenario: 'repeat',
    purpose: 'Measure stability when the same artifact payload is verified repeatedly.',
    command: `${securityCommandBase} --scenario repeat --runs ${runs}`,
    metricsCaptured: ['repeated-run stability'],
    expectedOutcome: 'Repeated requests continue returning HTTP 200 and signed receipts without contract drift.',
    timingsMs,
    statusCodes,
    successCount,
    failureCount: Math.max(0, runs - successCount),
    reliabilityNotes: [`${successCount}/${runs} repeated submissions of the same payload returned HTTP 200.`],
    caveats: successCount === runs ? [] : ['Some repeated submissions failed or diverged from the expected response shape.']
  };
}

async function scenarioBadAuth(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string
): Promise<RawScenarioResult> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];

  const missingAuth = await withMeasuredInject(
    app,
    {
      method: 'POST',
      url: '/api/v1/verify',
      payload: cleanBundle
    },
    (payload) => JSON.parse(payload) as { error?: string }
  );
  timingsMs.push(missingAuth.elapsedMs);
  statusCodes.push(missingAuth.statusCode);

  const invalidAuth = await withMeasuredInject(
    app,
    {
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': 'invalid-bench-api-key' },
      payload: cleanBundle
    },
    (payload) => JSON.parse(payload) as { error?: string }
  );
  timingsMs.push(invalidAuth.elapsedMs);
  statusCodes.push(invalidAuth.statusCode);

  const successCount = statusCodes.filter((code) => code === 401 || code === 403).length;

  return {
    scenario: 'bad-auth',
    purpose: 'Confirm evaluator-visible fail-closed behavior for missing or invalid API authentication.',
    command: `${securityCommandBase} --scenario bad-auth`,
    metricsCaptured: ['auth failure response latency'],
    expectedOutcome: 'Missing auth returns 401 and invalid auth returns 403.',
    timingsMs,
    statusCodes,
    successCount,
    failureCount: Math.max(0, 2 - successCount),
    reliabilityNotes: [`${successCount}/2 auth-failure probes returned the expected 401 or 403 response.`],
    caveats: successCount === 2 ? [] : ['One or more auth-failure probes did not return the expected status code.']
  };
}

async function scenarioMalformed(
  app: FastifyInstance,
  securityCommandBase: string
): Promise<RawScenarioResult> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];

  const emptyPayload = await withMeasuredInject(
    app,
    {
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': DEFAULT_API_KEY },
      payload: {}
    },
    (payload) => JSON.parse(payload) as { error?: string }
  );
  timingsMs.push(emptyPayload.elapsedMs);
  statusCodes.push(emptyPayload.statusCode);

  const malformedPayload = await withMeasuredInject(
    app,
    {
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': DEFAULT_API_KEY },
      payload: { bundleId: 'MALFORMED-001', doc: { docHash: 42 } }
    },
    (payload) => JSON.parse(payload) as { error?: string }
  );
  timingsMs.push(malformedPayload.elapsedMs);
  statusCodes.push(malformedPayload.statusCode);

  const successCount = statusCodes.filter((code) => code === 400).length;

  return {
    scenario: 'malformed',
    purpose: 'Confirm malformed evaluator payloads fail early without entering the verification lifecycle.',
    command: `${securityCommandBase} --scenario malformed`,
    metricsCaptured: ['payload validation failure latency'],
    expectedOutcome: 'HTTP 400 with Invalid payload error.',
    timingsMs,
    statusCodes,
    successCount,
    failureCount: Math.max(0, 2 - successCount),
    reliabilityNotes: [`${successCount}/2 malformed payload probes returned HTTP 400.`],
    caveats: successCount === 2 ? [] : ['One or more malformed payload probes did not return HTTP 400.']
  };
}

async function scenarioDependencyFailure(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string
): Promise<RawScenarioResult> {
  const subjectName = 'ACME HOLDINGS LLC';
  const response = await withMeasuredInject(
    app,
    {
      method: 'POST',
      url: '/api/v1/verify',
      headers: { 'x-api-key': DEFAULT_API_KEY },
      payload: {
        ...cleanBundle,
        bundleId: 'BENCH-DEPENDENCY-FAILURE',
        registryScreening: {
          subjectName,
          sourceIds: ['sam_exclusions'],
          forceRefresh: true
        }
      }
    },
    (payload) => JSON.parse(payload) as VerifyResponse
  );

  const success =
    response.statusCode === 200 &&
    response.body.decision !== 'ALLOW' &&
    Array.isArray(response.body.reasons) &&
    response.body.reasons.length > 0;

  return {
    scenario: 'dependency-failure',
    purpose: 'Measure fail-closed behavior when an external registry dependency is unavailable without configured access.',
    command: `${securityCommandBase} --scenario dependency-failure`,
    metricsCaptured: ['dependency failure response latency'],
    expectedOutcome: 'HTTP 200 with a non-ALLOW decision reflecting compliance-gap or fail-closed handling.',
    timingsMs: [response.elapsedMs],
    statusCodes: [response.statusCode],
    successCount: success ? 1 : 0,
    failureCount: success ? 0 : 1,
    reliabilityNotes: [
      success
        ? 'Registry dependency failure produced a non-ALLOW decision without exposing internal dependency details.'
        : 'Registry dependency failure did not produce the expected fail-closed decision.'
    ],
    caveats: success ? [] : ['Dependency-failure scenario did not reproduce the expected fail-closed outcome.']
  };
}

async function scenarioBatch(
  app: FastifyInstance,
  cleanBundle: BundleInput,
  securityCommandBase: string,
  batchSize: number
): Promise<RawScenarioResult> {
  const timingsMs: number[] = [];
  const statusCodes: number[] = [];
  let successCount = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const response = await withMeasuredInject(
      app,
      {
        method: 'POST',
        url: '/api/v1/verify',
        headers: { 'x-api-key': DEFAULT_API_KEY },
        payload: { ...cleanBundle, bundleId: `BENCH-BATCH-${index + 1}` }
      },
      (payload) => JSON.parse(payload) as VerifyResponse
    );
    timingsMs.push(response.elapsedMs);
    statusCodes.push(response.statusCode);
    if (response.statusCode === 200 && response.body.receiptId) {
      successCount += 1;
    }
  }

  return {
    scenario: 'batch',
    purpose: 'Measure sequential small-batch behavior over a short evaluator run.',
    command: `${securityCommandBase} --scenario batch --batch-size ${batchSize}`,
    metricsCaptured: ['small batch latency distribution'],
    expectedOutcome: `All ${batchSize} sequential requests return HTTP 200 with signed receipts.`,
    timingsMs,
    statusCodes,
    successCount,
    failureCount: Math.max(0, batchSize - successCount),
    reliabilityNotes: [`${successCount}/${batchSize} batch requests returned HTTP 200.`],
    caveats: successCount === batchSize ? [] : ['The small batch run included one or more failed requests.']
  };
}

function toAggregatedResult(result: RawScenarioResult): AggregatedScenarioResult {
  return {
    ...result,
    summary: summarizeTimings(result.timingsMs)
  };
}

function pickScenarioList(requested: CliOptions['scenario']): ScenarioName[] {
  if (requested === 'all') {
    return ['clean', 'tampered', 'repeat', 'lookup', 'bad-auth', 'malformed', 'dependency-failure', 'batch'];
  }

  return [requested];
}

function buildMarkdownReport(output: BenchmarkOutput): string {
  const lines: string[] = [];
  lines.push('# TrustSignal Benchmark Snapshot');
  lines.push('');
  lines.push('## Test Date/Time');
  lines.push(`- ${output.generatedAt}`);
  lines.push('');
  lines.push('## Environment Description');
  lines.push(`- Node: ${output.environment.node}`);
  lines.push(`- Platform: ${output.environment.platform} (${output.environment.arch})`);
  lines.push(`- Host: ${output.environment.hostname}`);
  lines.push(`- Temp database: ${output.environment.tempDatabase.engine} on 127.0.0.1:${output.environment.tempDatabase.port}`);
  lines.push(`- Harness command: \`${output.command}\``);
  lines.push('');
  lines.push('## Iteration / Sample Notes');
  for (const note of output.harness.sampleNotes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('## Environment Notes');
  for (const note of output.environment.notes) {
    lines.push(`- ${note}`);
  }
  lines.push('');
  lines.push('## Scenarios Executed');
  for (const scenario of output.scenarios) {
    lines.push(`- ${scenario.scenario}: ${scenario.purpose}`);
  }
  lines.push('');
  lines.push('## Timing Summary Table');
  lines.push('');
  lines.push('| Scenario | Count | Min (ms) | Max (ms) | Mean (ms) | Median (ms) | p95 (ms) | Success / Total |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const scenario of output.scenarios) {
    lines.push(
      `| ${scenario.scenario} | ${scenario.summary.count} | ${scenario.summary.minMs} | ${scenario.summary.maxMs} | ${scenario.summary.meanMs} | ${scenario.summary.medianMs} | ${scenario.summary.p95Ms} | ${scenario.successCount}/${scenario.successCount + scenario.failureCount} |`
    );
  }
  lines.push('');
  lines.push('## Reliability Notes');
  for (const scenario of output.scenarios) {
    for (const note of scenario.reliabilityNotes) {
      lines.push(`- ${scenario.scenario}: ${note}`);
    }
  }
  lines.push('');
  lines.push('## Notable Failures Or Caveats');
  if (output.notableFailures.length === 0 && output.caveats.length === 0) {
    lines.push('- No harness-level failures were observed in this run.');
  } else {
    for (const failure of output.notableFailures) {
      lines.push(`- ${failure}`);
    }
    for (const caveat of output.caveats) {
      lines.push(`- ${caveat}`);
    }
  }
  lines.push('');
  lines.push('## What This Means For Evaluators');
  lines.push('- This is a recent local evaluator run against the current public `/api/v1/*` lifecycle, not a production SLA.');
  lines.push('- The numbers are most useful for comparing request classes, verifying fail-closed behavior, and spotting regressions between local validation runs.');
  lines.push('- Clean verification, receipt lookup, and later verification can be exercised repeatedly with signed-receipt persistence under a reproducible local database setup.');
  lines.push('- Tampered and dependency-failure scenarios surface behavior signals that evaluators can test without exposing proof internals, signer infrastructure, or internal topology.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const requestedScenarios = pickScenarioList(options.scenario);
  const commandBase = 'npx tsx bench/run-bench.ts';
  const fullCommand = `${commandBase} --scenario ${options.scenario} --runs ${options.runs} --batch-size ${options.batchSize}`;

  await ensureBenchDirectories(options.outputDir);

  let tempPostgres: TempPostgres | null = null;
  let app: FastifyInstance | null = null;
  let prisma: PrismaClient | null = null;

  try {
    tempPostgres = await startTemporaryPostgres();

    process.env.DATABASE_URL = tempPostgres.databaseUrl;
    process.env.API_KEYS = DEFAULT_API_KEY;
    process.env.API_KEY_SCOPES = `${DEFAULT_API_KEY}=verify|read|anchor|revoke`;
    delete process.env.SAM_API_KEY;

    const { buildServer } = await import('../apps/api/src/server.js');
    prisma = new PrismaClient();
    app = await buildServer();
    app.log.level = 'fatal';

    const registry = await loadRegistry();
    await seedBaselineData(prisma, registry);

    const cleanArtifact = await loadFixtureText('clean-artifact.txt');
    const tamperedArtifact = await loadFixtureText('tampered-artifact.txt');

    const cleanBundle = await buildBundle(registry, cleanArtifact, {
      bundleId: 'BENCH-CLEAN-SEED',
      parcelId: 'BENCH-PARCEL-001',
      includePdfBase64: false
    });
    const tamperedBundle = await buildBundle(registry, tamperedArtifact, {
      bundleId: 'BENCH-TAMPER-SEED',
      parcelId: 'BENCH-PARCEL-002',
      declaredDocHash: cleanBundle.doc.docHash,
      includePdfBase64: true
    });

    const scenarioResults: AggregatedScenarioResult[] = [];
    let verificationRequestLatency: TimingSummary | null = null;
    let signedReceiptGenerationLatency: TimingSummary | null = null;
    let laterVerificationLatency: TimingSummary | null = null;
    let statusLookupLatency: TimingSummary | null = null;
    let tamperedArtifactDetectionLatency: TimingSummary | null = null;
    let repeatedRunStability: TimingSummary | null = null;

    if (requestedScenarios.includes('clean')) {
      const clean = await scenarioClean(app, cleanBundle, commandBase, options.runs);
      const aggregated = toAggregatedResult(clean.scenario);
      scenarioResults.push(aggregated);
      verificationRequestLatency = aggregated.summary;
      signedReceiptGenerationLatency = summarizeTimings(clean.signingTimings);
    }

    if (requestedScenarios.includes('tampered')) {
      const tampered = toAggregatedResult(
        await scenarioTampered(app, tamperedBundle, commandBase, options.runs)
      );
      scenarioResults.push(tampered);
      tamperedArtifactDetectionLatency = tampered.summary;
    }

    if (requestedScenarios.includes('repeat')) {
      const repeated = toAggregatedResult(
        await scenarioRepeat(app, cleanBundle, commandBase, options.runs)
      );
      scenarioResults.push(repeated);
      repeatedRunStability = repeated.summary;
    }

    if (requestedScenarios.includes('lookup')) {
      const lookup = await scenarioLookup(app, cleanBundle, commandBase, options.runs);
      const lookupAggregated = toAggregatedResult(lookup.lookup);
      const laterVerificationAggregated = toAggregatedResult(lookup.laterVerification);
      scenarioResults.push(lookupAggregated, laterVerificationAggregated);
      statusLookupLatency = lookupAggregated.summary;
      laterVerificationLatency = laterVerificationAggregated.summary;
    }

    if (requestedScenarios.includes('bad-auth')) {
      scenarioResults.push(
        toAggregatedResult(await scenarioBadAuth(app, cleanBundle, commandBase))
      );
    }

    if (requestedScenarios.includes('malformed')) {
      scenarioResults.push(
        toAggregatedResult(await scenarioMalformed(app, commandBase))
      );
    }

    if (requestedScenarios.includes('dependency-failure')) {
      scenarioResults.push(
        toAggregatedResult(await scenarioDependencyFailure(app, cleanBundle, commandBase))
      );
    }

    if (requestedScenarios.includes('batch')) {
      scenarioResults.push(
        toAggregatedResult(await scenarioBatch(app, cleanBundle, commandBase, options.batchSize))
      );
    }

    const notableFailures = scenarioResults
      .filter((scenario) => scenario.failureCount > 0)
      .map((scenario) => `${scenario.scenario}: ${scenario.failureCount} failed observation(s) out of ${scenario.successCount + scenario.failureCount}.`);
    const caveats = scenarioResults.flatMap((scenario) => scenario.caveats.map((note) => `${scenario.scenario}: ${note}`));
    if (requestedScenarios.includes('tampered')) {
      caveats.push(
        'tampered: The tampered scenario uses a local byte fixture to force a declared-hash mismatch. It is suitable for evaluator behavior checks, not for asserting document-parser completeness.'
      );
    }

    const output: BenchmarkOutput = {
      generatedAt: new Date().toISOString(),
      command: fullCommand,
      environment: {
        node: process.version,
        platform: os.platform(),
        arch: os.arch(),
        hostname: os.hostname(),
        tempDatabase: {
          engine: 'postgresql',
          port: tempPostgres.port,
          dbName: tempPostgres.dbName
        },
        notes: [
          'Local benchmark run on a developer workstation using a temporary PostgreSQL instance.',
          'The harness exercises the public /api/v1/* evaluator lifecycle through Fastify injection rather than an external network hop.',
          'No production load balancer, cross-service network latency, or remote datastore variance is included in these numbers.'
        ]
      },
      harness: {
        scenario: options.scenario,
        runs: options.runs,
        batchSize: options.batchSize,
        sampleNotes: [
          `Primary timing samples use ${options.runs} iterations per scenario when applicable.`,
          `The sequential batch scenario uses ${options.batchSize} requests.`,
          'First-run initialization effects may appear in max and p95 values, especially on scenarios that touch additional parsing or compliance paths.'
        ]
      },
      metrics: {
        verificationRequestLatency,
        signedReceiptGenerationLatency,
        laterVerificationLatency,
        statusLookupLatency,
        tamperedArtifactDetectionLatency,
        repeatedRunStability
      },
      scenarios: scenarioResults,
      notableFailures,
      caveats
    };

    const jsonPath = path.join(options.outputDir, 'latest.json');
    const markdownPath = path.join(options.outputDir, 'latest.md');
    await fs.writeFile(jsonPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
    await fs.writeFile(markdownPath, buildMarkdownReport(output), 'utf8');

    console.log(JSON.stringify({ jsonPath, markdownPath }, null, 2));
  } finally {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
    await stopTemporaryPostgres(tempPostgres);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
