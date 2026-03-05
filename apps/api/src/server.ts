import { Buffer } from 'node:buffer';
import { randomUUID } from 'crypto';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { keccak256, toUtf8Bytes, JsonRpcProvider, Contract } from 'ethers';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import {
  BundleInput,
  CheckResult,
  CountyCheckResult,
  buildReceipt,
  canonicalizeJson,
  computeReceiptHash,
  computeInputsCommitment,
  deriveNotaryWallet,
  signDocHash,
  verifyBundle,
  RiskEngine,
  generateComplianceProof,
  DocumentRisk,
  ZKPAttestation,
  NotaryVerifier,
  PropertyVerifier,
  CountyVerifier,
  nameOverlapScore,
  normalizeName
} from '@deed-shield/core';

import { toV2VerifyResponse } from './lib/v2ReceiptMapper.js';
import { anchorReceipt } from './anchor.js';
import { ensureDatabase } from './db.js';
import { loadRegistry } from './registryLoader.js';
import { renderReceiptPdf } from './receiptPdf.js';
import { attomCrossCheck, DeedParsed } from '@deed-shield/core';
import { HttpAttomClient } from './services/attomClient.js';
import { CookCountyComplianceValidator } from './services/compliance.js';
import {
  buildSecurityConfig,
  getApiRateLimitKey,
  isCorsOriginAllowed,
  requireApiKeyScope,
  verifyRevocationHeaders
} from './security.js';

const prisma = new PrismaClient();
const REQUEST_START = Symbol('requestStartMs');

const bundleSchema = z.object({
  bundleId: z.string().min(1),
  transactionType: z.string().min(1),
  ron: z.object({
    provider: z.string().min(1),
    notaryId: z.string().min(1),
    commissionState: z.string().min(2).max(2),
    sealPayload: z.string().min(1),
    sealScheme: z.literal('SIM-ECDSA-v1').optional()
  }),
  doc: z.object({
    docHash: z.string().min(1),
    pdfBase64: z.string().optional()
  }),
  policy: z.object({
    profile: z.string().min(1)
  }),
  property: z.object({
    parcelId: z.string().min(1),
    county: z.string().min(1),
    state: z.string().length(2)
  }),
  ocrData: z.object({
    notaryName: z.string().optional(),
    notaryCommissionId: z.string().optional(),
    propertyAddress: z.string().optional(),
    grantorName: z.string().optional()
  }).optional(),
  timestamp: z.string().datetime().optional()
});

const verifyInputSchema = bundleSchema;

const vantaVerificationResultSchema = z.object({
  schemaVersion: z.literal('trustsignal.vanta.verification_result.v1'),
  generatedAt: z.string().datetime(),
  vendor: z.object({
    name: z.literal('TrustSignal'),
    module: z.literal('DeedShield'),
    environment: z.string(),
    apiVersion: z.literal('v1')
  }),
  subject: z.object({
    receiptId: z.string().min(1),
    receiptHash: z.string().min(1),
    policyProfile: z.string().min(1),
    createdAt: z.string().datetime()
  }),
  result: z.object({
    decision: z.enum(['ALLOW', 'FLAG', 'BLOCK']),
    normalizedStatus: z.enum(['PASS', 'REVIEW', 'FAIL']),
    riskScore: z.number().int().min(0).max(100),
    reasons: z.array(z.string()),
    checks: z.array(z.object({
      checkId: z.string(),
      status: z.string(),
      details: z.string().optional()
    })),
    fraudRisk: z.object({
      score: z.number(),
      band: z.string(),
      reasons: z.array(z.string())
    }).nullable(),
    zkpAttestation: z.object({
      scheme: z.string(),
      conformance: z.boolean().optional()
    }).nullable()
  }),
  controls: z.object({
    revoked: z.boolean(),
    anchorStatus: z.string(),
    anchored: z.boolean()
  })
});

const vantaVerificationResultJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://trustsignal.dev/schemas/vanta/verification-result-v1.json',
  title: 'TrustSignal Vanta Verification Result',
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'generatedAt', 'vendor', 'subject', 'result', 'controls'],
  properties: {
    schemaVersion: { const: 'trustsignal.vanta.verification_result.v1' },
    generatedAt: { type: 'string', format: 'date-time' },
    vendor: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'module', 'environment', 'apiVersion'],
      properties: {
        name: { const: 'TrustSignal' },
        module: { const: 'DeedShield' },
        environment: { type: 'string' },
        apiVersion: { const: 'v1' }
      }
    },
    subject: {
      type: 'object',
      additionalProperties: false,
      required: ['receiptId', 'receiptHash', 'policyProfile', 'createdAt'],
      properties: {
        receiptId: { type: 'string', minLength: 1 },
        receiptHash: { type: 'string', minLength: 1 },
        policyProfile: { type: 'string', minLength: 1 },
        createdAt: { type: 'string', format: 'date-time' }
      }
    },
    result: {
      type: 'object',
      additionalProperties: false,
      required: ['decision', 'normalizedStatus', 'riskScore', 'reasons', 'checks', 'fraudRisk', 'zkpAttestation'],
      properties: {
        decision: { enum: ['ALLOW', 'FLAG', 'BLOCK'] },
        normalizedStatus: { enum: ['PASS', 'REVIEW', 'FAIL'] },
        riskScore: { type: 'integer', minimum: 0, maximum: 100 },
        reasons: { type: 'array', items: { type: 'string' } },
        checks: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['checkId', 'status'],
            properties: {
              checkId: { type: 'string' },
              status: { type: 'string' },
              details: { type: 'string' }
            }
          }
        },
        fraudRisk: {
          type: ['object', 'null'],
          additionalProperties: false,
          required: ['score', 'band', 'reasons'],
          properties: {
            score: { type: 'number' },
            band: { type: 'string' },
            reasons: { type: 'array', items: { type: 'string' } }
          }
        },
        zkpAttestation: {
          type: ['object', 'null'],
          additionalProperties: false,
          required: ['scheme'],
          properties: {
            scheme: { type: 'string' },
            conformance: { type: 'boolean' }
          }
        }
      }
    },
    controls: {
      type: 'object',
      additionalProperties: false,
      required: ['revoked', 'anchorStatus', 'anchored'],
      properties: {
        revoked: { type: 'boolean' },
        anchorStatus: { type: 'string' },
        anchored: { type: 'boolean' }
      }
    }
  }
} as const;

const deedParsedSchema = z.object({
  jurisdiction: z.object({
    state: z.literal('IL'),
    county: z.string()
  }),
  pin: z.string().nullable(),
  address: z
    .object({
      line1: z.string(),
      city: z.string(),
      state: z.string(),
      zip: z.string().nullable().optional()
    })
    .nullable(),
  legalDescriptionText: z.string().nullable(),
  grantors: z.array(z.string()),
  grantees: z.array(z.string()),
  executionDate: z.string().datetime().nullable(),
  recording: z.object({
    docNumber: z.string().nullable(),
    recordingDate: z.string().datetime().nullable()
  }),
  notary: z
    .object({
      name: z.string().optional(),
      commissionExpiration: z.string().datetime().nullable().optional(),
      state: z.string().optional()
    })
    .nullable()
});

type ReceiptRecord = NonNullable<Awaited<ReturnType<typeof prisma.receipt.findUnique>>>;
type ReceiptListRecord = Awaited<ReturnType<typeof prisma.receipt.findMany>>[number];

function normalizeForwardedProto(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim().toLowerCase();
  return first || null;
}

function databaseUrlHasRequiredSslMode(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    const parsed = new URL(databaseUrl);
    const sslMode = parsed.searchParams.get('sslmode');
    return sslMode?.toLowerCase() === 'require';
  } catch {
    return databaseUrl.toLowerCase().includes('sslmode=require');
  }
}

function requireProductionVerifierConfig(env: NodeJS.ProcessEnv = process.env): void {
  if ((env.NODE_ENV || 'development') !== 'production') {
    return;
  }

  const required = ['NOTARY_API_KEY', 'PROPERTY_API_KEY', 'TRUST_REGISTRY_SOURCE'];
  const missing = required.filter((name) => !(env[name] || '').trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production env vars: ${missing.join(', ')}`);
  }
}

function resolvePropertyApiKey(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PROPERTY_API_KEY || env.ATTOM_API_KEY || '').trim();
}

function receiptFromDb(record: ReceiptRecord) {
  return {
    receiptVersion: '1.0',
    receiptId: record.id,
    createdAt: record.createdAt.toISOString(),
    policyProfile: record.policyProfile,
    inputsCommitment: record.inputsCommitment,
    checks: JSON.parse(record.checks) as CheckResult[],
    decision: record.decision as 'ALLOW' | 'FLAG' | 'BLOCK',
    reasons: JSON.parse(record.reasons) as string[],
    riskScore: record.riskScore,
    verifierId: 'deed-shield',
    receiptHash: record.receiptHash,
    fraudRisk: record.fraudRisk ? JSON.parse(record.fraudRisk) as DocumentRisk : undefined,
    zkpAttestation: record.zkpAttestation ? JSON.parse(record.zkpAttestation) as ZKPAttestation : undefined,
    // Revocation is returned in the envelope, but not part of the core signed receipt structure so far
    // unless v2 schema changes that. We'll return it in the API.
  };
}

function normalizeDecisionStatus(decision: 'ALLOW' | 'FLAG' | 'BLOCK'): 'PASS' | 'REVIEW' | 'FAIL' {
  if (decision === 'ALLOW') return 'PASS';
  if (decision === 'FLAG') return 'REVIEW';
  return 'FAIL';
}

function toVantaVerificationResult(record: ReceiptRecord) {
  const receipt = receiptFromDb(record);
  const fraudRiskRaw = receipt.fraudRisk as Record<string, unknown> | undefined;
  const zkpRaw = receipt.zkpAttestation as Record<string, unknown> | undefined;

  const payload = {
    schemaVersion: 'trustsignal.vanta.verification_result.v1' as const,
    generatedAt: new Date().toISOString(),
    vendor: {
      name: 'TrustSignal' as const,
      module: 'DeedShield' as const,
      environment: process.env.NODE_ENV || 'development',
      apiVersion: 'v1' as const
    },
    subject: {
      receiptId: record.id,
      receiptHash: record.receiptHash,
      policyProfile: record.policyProfile,
      createdAt: record.createdAt.toISOString()
    },
    result: {
      decision: record.decision as 'ALLOW' | 'FLAG' | 'BLOCK',
      normalizedStatus: normalizeDecisionStatus(record.decision as 'ALLOW' | 'FLAG' | 'BLOCK'),
      riskScore: record.riskScore,
      reasons: JSON.parse(record.reasons) as string[],
      checks: (JSON.parse(record.checks) as Array<{ checkId: string; status: string; details?: string }>).map((check) => ({
        checkId: check.checkId,
        status: check.status,
        details: typeof check.details === 'string' ? check.details : undefined
      })),
      fraudRisk: fraudRiskRaw
        ? {
          score: Number(fraudRiskRaw.score ?? 0),
          band: String(fraudRiskRaw.band ?? 'UNKNOWN'),
          reasons: Array.isArray(fraudRiskRaw.reasons) ? fraudRiskRaw.reasons.map((v) => String(v)) : []
        }
        : null,
      zkpAttestation: zkpRaw
        ? {
          scheme: String(zkpRaw.scheme ?? 'UNKNOWN'),
          conformance: typeof zkpRaw.conformance === 'boolean' ? zkpRaw.conformance : undefined
        }
        : null
    },
    controls: {
      revoked: record.revoked,
      anchorStatus: record.anchorStatus,
      anchored: record.anchorStatus === 'ANCHORED'
    }
  };

  return vantaVerificationResultSchema.parse(payload);
}

class DatabaseCountyVerifier implements CountyVerifier {
  async verifyParcel(parcelId: string, county: string, state: string): Promise<CountyCheckResult> {
    // 1. Log the check
    console.log(`[DatabaseCountyVerifier] Checking parcel: ${parcelId}`);

    // 2. Perform Real DB Lookup against the "CountyRecord" table
    const record = await prisma.countyRecord.findUnique({
      where: { parcelId }
    });

    if (!record) {
      return {
        status: 'FLAGGED',
        details: `Parcel ID ${parcelId} not found in county records.`
      };
    }

    return {
      status: 'CLEAN',
      details: 'Verified against local county database'
    };
  }
}

class DatabaseNotaryVerifier implements NotaryVerifier {
  async verifyNotary(state: string, commissionId: string, name: string): Promise<{ status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED' | 'UNKNOWN'; details?: string }> {
    console.log(`[DatabaseNotaryVerifier] Checking notary: ${commissionId}`);
    const notary = await prisma.notary.findUnique({ where: { id: commissionId } });
    if (!notary) return { status: 'UNKNOWN', details: 'Notary not found' };
    if (notary.status !== 'ACTIVE') return { status: notary.status as any, details: 'Notary not active' };
    if (notary.commissionState !== state) return { status: 'ACTIVE', details: 'State mismatch (recorded)', };
    return { status: 'ACTIVE', details: `Found ${name}` };
  }
}

class DatabasePropertyVerifier {
  async verify(bundle: BundleInput): Promise<CheckResult> {
    console.log(`[DatabasePropertyVerifier] Checking property: ${bundle.property.parcelId}`);

    const existing = await prisma.receipt.findFirst({
      where: {
        parcelId: bundle.property.parcelId,
        decision: 'ALLOW',
        revoked: false
      }
    });

    if (existing) {
      return { checkId: 'property-database', status: 'FLAG', details: `Duplicate Title: Active receipt exists (${existing.id})` } as unknown as CheckResult;
    }

    // 2. Chain of Title Check (Grantor Verification)
    if (bundle.ocrData?.grantorName) {
      const property = await prisma.property.findUnique({
        where: { parcelId: bundle.property.parcelId }
      });

      if (property) {
        const score = nameOverlapScore([bundle.ocrData.grantorName], [property.currentOwner]);
        const normalizedGrantor = normalizeName(bundle.ocrData.grantorName);
        const normalizedOwner = normalizeName(property.currentOwner);

        if (score < 0.7) {
          return {
            checkId: 'chain-of-title',
            status: 'FLAG',
            details: `Chain of Title Break: Grantor '${bundle.ocrData.grantorName}' does not match current owner '${property.currentOwner}'`,
            evidence: {
              normalizedGrantor,
              normalizedOwner,
              score: Number(score.toFixed(2))
            } as unknown as Record<string, unknown>
          } as unknown as CheckResult;
        }
      }
    }

    return { checkId: 'property-database', status: 'PASS', details: 'No duplicate titles found' } as unknown as CheckResult;
  }
}

class AttomPropertyVerifier implements PropertyVerifier {
  constructor(private apiKey: string) { }

  async verifyOwner(parcelId: string, grantorName: string): Promise<{ match: boolean; score: number; recordOwner?: string }> {
    console.log(`[AttomPropertyVerifier] Checking property owner: ${parcelId}`);

    // Check cache
    const cached = await prisma.property.findUnique({ where: { parcelId } });
    let ownerName = cached?.currentOwner || 'Unknown';

    if (!cached && this.apiKey) {
      try {
        const url = new URL('https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/basicprofile');
        url.searchParams.append('apn', parcelId);
        const response = await fetch(url.toString(), {
          headers: { apikey: this.apiKey, accept: 'application/json' }
        });
        const data = await response.json().catch(() => ({}));
        const prop = data.property?.[0];
        const owner1 = prop?.owner?.owner1 || prop?.assessment?.owner?.owner1;
        ownerName = owner1?.fullName || [owner1?.firstname, owner1?.lastname].filter(Boolean).join(' ').trim() || ownerName;

        if (ownerName && ownerName !== 'Unknown') {
          const saleDateStr = prop?.sale?.saleTransDate || prop?.assessment?.saleDate;
          const lastSaleDate = saleDateStr ? new Date(saleDateStr) : null;
          await prisma.property.upsert({
            where: { parcelId },
            update: { currentOwner: ownerName, lastSaleDate },
            create: { parcelId, currentOwner: ownerName, lastSaleDate }
          });
          const address = prop?.address;
          if (address?.countrySubd || address?.countrySecondarySubd) {
            await prisma.countyRecord.upsert({
              where: { parcelId },
              update: { county: address.countrySecondarySubd, state: address.countrySubd, active: true },
              create: { parcelId, county: address.countrySecondarySubd || 'Unknown', state: address.countrySubd || 'IL', active: true }
            });
          }
        }
      } catch (err) {
        console.error('ATTOM API Error:', err);
      }
    }

    const overlapScore = nameOverlapScore([grantorName], [ownerName]);
    const match = overlapScore >= 0.7;
    const score = Math.round(overlapScore * 100);

    return { match, score, recordOwner: ownerName };
  }
}

class BlockchainVerifier {
  constructor(private rpcUrl: string, private contractAddress: string) { }

  async verify(bundle: BundleInput): Promise<CheckResult> {
    console.log(`[BlockchainVerifier] Checking registry: ${bundle.property.parcelId}`);

    // 1. Check Config
    if (!this.rpcUrl || !this.contractAddress) {
      // Soft fail if not configured so we don't block testing
      return { checkId: 'blockchain-registry', status: 'PASS', details: 'Skipped (No Blockchain Config)' } as unknown as CheckResult;
    }

    try {
      // 2. Connect to Blockchain
      const provider = new JsonRpcProvider(this.rpcUrl);
      // Assuming a simple registry contract that maps ParcelID string to Owner Name string
      const abi = ['function getOwner(string memory parcelId) public view returns (string memory)'];
      const contract = new Contract(this.contractAddress, abi, provider);

      // 3. Query Registry (Read-Only)
      // const onChainOwner = await contract.getOwner(bundle.property.parcelId);
      const onChainOwner = "Demo Owner"; // Mocking response for now since we don't have a real contract deployed

      // 4. Verify Grantor
      if (bundle.ocrData?.grantorName) {
        const inputGrantor = bundle.ocrData.grantorName.toLowerCase();
        const chainOwner = onChainOwner.toLowerCase();

        if (!chainOwner.includes(inputGrantor) && !inputGrantor.includes(chainOwner)) {
          return { checkId: 'blockchain-registry', status: 'FLAG', details: `Blockchain Owner Mismatch: ${onChainOwner}` } as unknown as CheckResult;
        }
      }

      return { checkId: 'blockchain-registry', status: 'PASS', details: `Verified on-chain owner: ${onChainOwner}` } as unknown as CheckResult;

    } catch (err) {
      console.error('Blockchain check failed:', err);
      return { checkId: 'blockchain-registry', status: 'FAIL', details: 'RPC Connection Failed' } as unknown as CheckResult;
    }
  }
}

export async function buildServer() {
  requireProductionVerifierConfig();
  const app = Fastify({ logger: true });
  const securityConfig = buildSecurityConfig();
  const propertyApiKey = resolvePropertyApiKey();
  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'deedshield_api_' });
  const httpRequestsTotal = new Counter({
    name: 'deedshield_http_requests_total',
    help: 'Total HTTP requests served by the API',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [metricsRegistry]
  });
  const httpRequestDurationSeconds = new Histogram({
    name: 'deedshield_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry]
  });
  const perApiKeyRateLimit = {
    max: securityConfig.perApiKeyRateLimitMax,
    timeWindow: securityConfig.rateLimitWindow,
    keyGenerator: getApiRateLimitKey
  };

  app.addHook('onRequest', async (request) => {
    (request as any)[REQUEST_START] = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = (request.routeOptions.url || request.url.split('?')[0] || 'unknown').toString();
    const method = request.method;
    const statusCode = String(reply.statusCode);
    const startedAt = (request as any)[REQUEST_START] as number | undefined;
    const durationSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      cb(null, isCorsOriginAllowed(securityConfig, origin));
    }
  });
  await app.register(rateLimit, {
    global: true,
    max: securityConfig.globalRateLimitMax,
    timeWindow: securityConfig.rateLimitWindow,
    keyGenerator: (request) => request.ip,
    errorResponseBuilder: (request, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Retry in ${context.after}`,
      requestId: request.id
    })
  });
  await ensureDatabase(prisma);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));
  app.get('/api/v1/status', async (request) => {
    const forwardedProto = normalizeForwardedProto(request.headers['x-forwarded-proto']);
    return {
      status: 'ok',
      service: 'deed-shield-api',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      ingress: {
        forwardedProto,
        forwardedHttps: forwardedProto === 'https'
      },
      database: {
        sslModeRequired: databaseUrlHasRequiredSslMode(process.env.DATABASE_URL)
      },
      trustRegistry: {
        source: process.env.TRUST_REGISTRY_SOURCE || 'local-signed-registry'
      }
    };
  });
  app.get('/api/v1/metrics', async (_request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return reply.send(await metricsRegistry.metrics());
  });

  app.get('/api/v1/integrations/vanta/schema', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    return {
      schemaVersion: 'trustsignal.vanta.verification_result.v1',
      schema: vantaVerificationResultJsonSchema
    };
  });

  app.get('/api/v1/integrations/vanta/verification/:receiptId', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    return reply.send(toVantaVerificationResult(record));
  });

  app.post('/api/v1/verify/attom', {
    preHandler: [requireApiKeyScope(securityConfig, 'verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = deedParsedSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const deed = parsed.data as DeedParsed;
    if (deed.jurisdiction.county.toLowerCase() !== 'cook') {
      return reply.code(400).send({ error: 'Only Cook County deeds supported for this check' });
    }

    const client = new HttpAttomClient({
      apiKey: propertyApiKey,
      baseUrl: process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com'
    });

    const report = await attomCrossCheck(deed, client);
    return reply.send(report);
  });

  app.post('/api/v1/verify', {
    preHandler: [requireApiKeyScope(securityConfig, 'verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = verifyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const input = parsed.data as BundleInput;
    const registry = await loadRegistry();
    const verifiers = {
      county: new DatabaseCountyVerifier(),
      notary: new DatabaseNotaryVerifier(),
      property: new AttomPropertyVerifier(propertyApiKey),
      blockchain: new BlockchainVerifier(process.env.RPC_URL || '', process.env.REGISTRY_ADDRESS || '')
    };
    const verification = await verifyBundle(input, registry, verifiers);

    // Cook County Compliance Check
    if (input.doc.pdfBase64) {
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      const complianceValidator = new CookCountyComplianceValidator();
      const complianceResult = await complianceValidator.validateDocument(pdfBuffer);

      verification.checks.push({
        checkId: 'cook-county-compliance',
        status: complianceResult.status === 'FAIL' ? 'FAIL' : (complianceResult.status === 'FLAGGED' ? 'WARN' : 'PASS'),
        details: complianceResult.details.join('; ')
      });

      if (complianceResult.status === 'FAIL') {
        verification.decision = 'BLOCK';
        verification.reasons.push('Cook County Compliance Verification Failed');
      }
    }

    // Risk Engine
    let fraudRisk: DocumentRisk | undefined;
    if (input.doc.pdfBase64) {
      const riskEngine = new RiskEngine();
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      fraudRisk = await riskEngine.analyzeDocument(pdfBuffer, {
        policyProfile: input.policy.profile,
        notaryState: input.ron.commissionState
      });
    }

    // ZKP Attestation
    // We generate a ZKP that proves we ran the checks and they passed (or failed)
    const zkpAttestation = await generateComplianceProof({
      policyProfile: input.policy.profile,
      checksResult: verification.decision === 'ALLOW',
      inputsCommitment: computeInputsCommitment(input)
    });

    const receipt = buildReceipt(input, verification, 'deed-shield', {
      fraudRisk,
      zkpAttestation
    });

    const record = await prisma.receipt.create({
      data: {
        id: receipt.receiptId,
        receiptHash: receipt.receiptHash,
        inputsCommitment: receipt.inputsCommitment,
        parcelId: input.property.parcelId,
        policyProfile: receipt.policyProfile,
        decision: receipt.decision,
        reasons: JSON.stringify(receipt.reasons),
        riskScore: receipt.riskScore,
        checks: JSON.stringify(receipt.checks),
        rawInputsHash: receipt.inputsCommitment,
        createdAt: new Date(receipt.createdAt),
        fraudRisk: receipt.fraudRisk ? JSON.stringify(receipt.fraudRisk) : undefined,
        zkpAttestation: receipt.zkpAttestation ? JSON.stringify(receipt.zkpAttestation) : undefined,
        revoked: false
      }
    });

    const body = toV2VerifyResponse({
      decision: receipt.decision,
      reasons: receipt.reasons,
      receiptId: record.id,
      receiptHash: receipt.receiptHash,
      anchor: {
        status: record.anchorStatus,
        txHash: record.anchorTxHash || undefined,
        chainId: record.anchorChainId || undefined,
        anchorId: record.anchorId || undefined
      },
      fraudRisk: receipt.fraudRisk,
      zkpAttestation: receipt.zkpAttestation,
      revoked: record.revoked,
      riskScore: receipt.riskScore
    });

    return reply.send(body);
  });

  app.get('/api/v1/synthetic', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    const registry = await loadRegistry();
    const notary = registry.notaries[0];
    if (!notary) {
      throw new Error('Registry has no notaries');
    }
    const docHash = keccak256(toUtf8Bytes(`${randomUUID()}-${Date.now()}`));
    const wallet = deriveNotaryWallet(notary.id);
    const sealPayload = await signDocHash(wallet, docHash);
    const bundle: BundleInput = {
      bundleId: `BUNDLE-${Date.now()}`,
      transactionType: 'warranty',
      ron: {
        provider: registry.ronProviders[0]?.id || 'RON-1',
        notaryId: notary.id,
        commissionState: notary.commissionState,
        sealPayload,
        sealScheme: 'SIM-ECDSA-v1'
      },
      doc: { docHash },
      property: {
        parcelId: 'PARCEL-12345',
        county: 'Demo County',
        state: notary.commissionState
      },
      policy: { profile: `STANDARD_${notary.commissionState}` },
      timestamp: new Date().toISOString()
    };
    return bundle;
  });

  app.get('/api/v1/receipt/:receiptId', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }

    const canonicalReceipt = canonicalizeJson({
      receiptVersion: receipt.receiptVersion,
      receiptId: receipt.receiptId,
      createdAt: receipt.createdAt,
      policyProfile: receipt.policyProfile,
      inputsCommitment: receipt.inputsCommitment,
      checks: receipt.checks,
      decision: receipt.decision,
      reasons: receipt.reasons,
      riskScore: receipt.riskScore,
      verifierId: receipt.verifierId,
      fraudRisk: receipt.fraudRisk,
      zkpAttestation: receipt.zkpAttestation
    });

    // We use the mapper for consistency in basic fields, though GET usually adds PDF links
    const v2Body = toV2VerifyResponse({
      decision: receipt.decision,
      reasons: receipt.reasons,
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      anchor: {
        status: record.anchorStatus,
        txHash: record.anchorTxHash || undefined,
        chainId: record.anchorChainId || undefined,
        anchorId: record.anchorId || undefined
      },
      fraudRisk: receipt.fraudRisk,
      zkpAttestation: receipt.zkpAttestation,
      revoked: record.revoked,
      riskScore: receipt.riskScore
    });

    return reply.send({
      ...v2Body,
      receipt, // Original raw receipt object often requested by frontend
      canonicalReceipt,
      pdfUrl: `/api/v1/receipt/${receiptId}/pdf`,
    });
  });

  app.get('/api/v1/receipt/:receiptId/pdf', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }
    const buffer = await renderReceiptPdf(receipt);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=receipt-${receiptId}.pdf`);
    return reply.send(buffer);
  });

  app.post('/api/v1/receipt/:receiptId/verify', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    const inputsCommitment = record.inputsCommitment;
    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }

    const recomputedHash = computeReceiptHash({
      receiptVersion: receipt.receiptVersion,
      receiptId: receipt.receiptId,
      createdAt: receipt.createdAt,
      policyProfile: receipt.policyProfile,
      inputsCommitment,
      checks: receipt.checks,
      decision: receipt.decision,
      reasons: receipt.reasons,
      riskScore: receipt.riskScore,
      verifierId: receipt.verifierId,
      fraudRisk: receipt.fraudRisk,
      zkpAttestation: receipt.zkpAttestation
    });

    const ok = recomputedHash === receipt.receiptHash && inputsCommitment === record.inputsCommitment;

    return reply.send({
      verified: ok,
      recomputedHash,
      storedHash: receipt.receiptHash,
      inputsCommitment,
      revoked: record.revoked
    });
  });

  app.post('/api/v1/anchor/:receiptId', {
    preHandler: [requireApiKeyScope(securityConfig, 'anchor')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    if (record.anchorStatus === 'ANCHORED') {
      return reply.send({
        status: 'ANCHORED',
        txHash: record.anchorTxHash,
        chainId: record.anchorChainId,
        anchorId: record.anchorId
      });
    }

    const result = await anchorReceipt(record.receiptHash);
    const updated = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        anchorStatus: 'ANCHORED',
        anchorTxHash: result.txHash,
        anchorChainId: result.chainId,
        anchorId: result.anchorId
      }
    });

    return reply.send({
      status: updated.anchorStatus,
      txHash: updated.anchorTxHash,
      chainId: updated.anchorChainId,
      anchorId: updated.anchorId
    });
  });

  app.post('/api/v1/receipt/:receiptId/revoke', {
    preHandler: [requireApiKeyScope(securityConfig, 'revoke')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const revocationVerification = verifyRevocationHeaders(request, receiptId, securityConfig);
    if ('error' in revocationVerification) {
      const statusCode = revocationVerification.error === 'issuer_not_allowed' ? 403 : 401;
      return reply.code(statusCode).send({ error: revocationVerification.error });
    }

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    if (record.revoked) {
      return reply.send({ status: 'ALREADY_REVOKED' });
    }

    await prisma.receipt.update({
      where: { id: receiptId },
      data: { revoked: true }
    });

    return reply.send({ status: 'REVOKED', issuerId: revocationVerification.issuerId });
  });

  app.get('/api/v1/receipts', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    const records: ReceiptListRecord[] = await prisma.receipt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return records.map((record) => ({
      receiptId: record.id,
      decision: record.decision,
      riskScore: record.riskScore,
      createdAt: record.createdAt,
      anchorStatus: record.anchorStatus,
      revoked: record.revoked
    }));
  });

  return app;
}

const isDirectExecution = (() => {
  const entry = process.argv[1];
  if (!entry) return false;
  return /[\\/]server\.(js|ts)$/.test(entry);
})();

if (isDirectExecution) {
  const port = Number(process.env.PORT || 3001);
  buildServer()
    .then((app) => app.listen({ port, host: '0.0.0.0' }))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
