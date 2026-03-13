import { readFileSync } from 'node:fs';
import path from 'node:path';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

import type { DeedParsed } from '../../../packages/public-contracts/dist/index.js';

import {
  getArtifactReceiptById,
  issueArtifactReceipt,
  toArtifactReceiptPublicView,
  toArtifactReceiptSummaryView,
  verifyArtifactReceiptById
} from './artifactReceipts.js';
import { toV2VerifyResponse } from './lib/v2ReceiptMapper.js';
import { ensureDatabase } from './db.js';
import { renderReceiptPdf } from './receiptPdf.js';
import { createLocalVerificationEngine } from './engine/localVerificationEngine.js';
import type { EngineVerificationInput } from './engine/types.js';
import {
  REGISTRY_SOURCE_IDS,
  type RegistrySourceId
} from './registry/catalog.js';
import {
  buildSecurityConfig,
  getApiRateLimitKey,
  isCorsOriginAllowed,
  requireApiKeyScope,
  verifyRevocationHeaders
} from './security.js';

function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const direct = (env.DATABASE_URL || '').trim();
  if (direct) return direct;

  const candidates = [
    env.SUPABASE_DB_URL,
    env.SUPABASE_POOLER_URL,
    env.SUPABASE_DIRECT_URL
  ];

  for (const candidate of candidates) {
    const value = (candidate || '').trim();
    if (value) {
      env.DATABASE_URL = value;
      return value;
    }
  }

  const supabasePassword = (env.SUPABASE_DB_PASSWORD || '').trim();
  if (supabasePassword) {
    const poolerCandidates = [
      path.resolve(process.cwd(), 'supabase/.temp/pooler-url'),
      path.resolve(process.cwd(), '../../supabase/.temp/pooler-url'),
      path.resolve(process.env.HOME || '', 'supabase/.temp/pooler-url')
    ];
    for (const poolerPath of poolerCandidates) {
      try {
        const rawPoolerUrl = readFileSync(poolerPath, 'utf-8').trim();
        if (!rawPoolerUrl) continue;
        const parsed = new URL(rawPoolerUrl);
        if (!parsed.password) {
          parsed.password = encodeURIComponent(supabasePassword);
        }
        parsed.searchParams.set('sslmode', 'require');
        const resolved = parsed.toString();
        env.DATABASE_URL = resolved;
        return resolved;
      } catch {
        // continue searching
      }
    }
  }

  return null;
}

resolveDatabaseUrl();
const prisma = new PrismaClient();
const REQUEST_START = Symbol('requestStartMs');
const registrySourceIdEnum = z.enum(REGISTRY_SOURCE_IDS);

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
  registryScreening: z
    .object({
      subjectName: z.string().trim().min(2).max(256).optional(),
      sourceIds: z.array(registrySourceIdEnum).min(1).max(50).optional(),
      forceRefresh: z.boolean().optional()
    })
    .optional(),
  timestamp: z.string().datetime().optional()
});

const verifyInputSchema = bundleSchema;
const artifactHashSchema = z
  .string()
  .trim()
  .regex(/^[A-Fa-f0-9]{64}$/, 'artifact.hash must be a 64-character SHA-256 hex digest')
  .transform((value) => value.toLowerCase());
const artifactSchema = z.object({
  hash: artifactHashSchema,
  algorithm: z.literal('sha256')
});
const artifactVerificationRequestSchema = z.object({
  artifact: artifactSchema,
  source: z.object({
    provider: z.string().trim().min(1).max(128),
    repository: z.string().trim().min(1).max(256).optional(),
    workflow: z.string().trim().min(1).max(256).optional(),
    runId: z.string().trim().min(1).max(128).optional(),
    commit: z.string().trim().min(1).max(128).optional(),
    actor: z.string().trim().min(1).max(128).optional()
  }),
  metadata: z.object({
    artifactPath: z.string().trim().min(1).max(1024).optional()
  }).optional()
}).strict();
const artifactReceiptVerifySchema = z.object({
  artifact: artifactSchema
}).strict();
const registryVerifyInputSchema = z.object({
  sourceId: registrySourceIdEnum,
  subjectName: z.string().trim().min(2).max(256),
  forceRefresh: z.boolean().optional()
});
const registryVerifyBatchInputSchema = z.object({
  sourceIds: z.array(registrySourceIdEnum).min(1).max(50),
  subjectName: z.string().trim().min(2).max(256),
  forceRefresh: z.boolean().optional()
});
const receiptIdParamSchema = z.object({
  receiptId: z.string().uuid()
});

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
      details: z.string().optional(),
      source_name: z.string().optional()
    })),
    fraudRisk: z.object({
      score: z.number(),
      band: z.string(),
      reasons: z.array(z.string())
    }).nullable(),
    zkpAttestation: z.object({
      scheme: z.string(),
      status: z.enum(['dev-only', 'verifiable']),
      backend: z.string(),
      circuitId: z.string().optional(),
      verificationKeyId: z.string().optional(),
      verifiedAt: z.string().datetime().optional(),
      publicInputs: z.object({
        policyHash: z.string(),
        timestamp: z.string().datetime(),
        inputsCommitment: z.string(),
        conformance: z.boolean(),
        declaredDocHash: z.string(),
        documentDigest: z.string(),
        documentCommitment: z.string(),
        schemaVersion: z.string(),
        documentWitnessMode: z.enum(['canonical-document-bytes-v1', 'declared-doc-hash-v1'])
      }),
      proofArtifact: z.object({
        format: z.string(),
        digest: z.string(),
        encoding: z.enum(['base64']).optional(),
        proof: z.string().optional()
      }).optional()
    }).nullable()
  }),
  controls: z.object({
    revoked: z.boolean(),
    anchorStatus: z.string(),
    anchored: z.boolean(),
    receiptSignaturePresent: z.boolean(),
    receiptSignatureAlg: z.string().nullable(),
    receiptSignatureKid: z.string().nullable(),
    signatureVerified: z.boolean(),
    anchorSubjectDigest: z.string().optional(),
    anchorSubjectVersion: z.string().optional(),
    anchoredAt: z.string().datetime().optional()
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
              details: { type: 'string' },
              source_name: { type: 'string' }
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
          required: ['scheme', 'status', 'backend', 'publicInputs'],
          properties: {
            scheme: { type: 'string' },
            status: { enum: ['dev-only', 'verifiable'] },
            backend: { type: 'string' },
            circuitId: { type: 'string' },
            verificationKeyId: { type: 'string' },
            verifiedAt: { type: 'string', format: 'date-time' },
            publicInputs: {
              type: 'object',
              additionalProperties: false,
              required: [
                'policyHash',
                'timestamp',
                'inputsCommitment',
                'conformance',
                'declaredDocHash',
                'documentDigest',
                'documentCommitment',
                'schemaVersion',
                'documentWitnessMode'
              ],
              properties: {
                policyHash: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                inputsCommitment: { type: 'string' },
                conformance: { type: 'boolean' },
                declaredDocHash: { type: 'string' },
                documentDigest: { type: 'string' },
                documentCommitment: { type: 'string' },
                schemaVersion: { type: 'string' },
                documentWitnessMode: {
                  enum: ['canonical-document-bytes-v1', 'declared-doc-hash-v1']
                }
              }
            },
            proofArtifact: {
              type: 'object',
              additionalProperties: false,
              required: ['format', 'digest'],
              properties: {
                format: { type: 'string' },
                digest: { type: 'string' },
                encoding: { enum: ['base64'] },
                proof: { type: 'string' }
              }
            }
          }
        }
      }
    },
    controls: {
      type: 'object',
      additionalProperties: false,
      required: ['revoked', 'anchorStatus', 'anchored', 'receiptSignaturePresent', 'receiptSignatureAlg', 'receiptSignatureKid', 'signatureVerified'],
      properties: {
        revoked: { type: 'boolean' },
        anchorStatus: { type: 'string' },
        anchored: { type: 'boolean' },
        receiptSignaturePresent: { type: 'boolean' },
        receiptSignatureAlg: { type: ['string', 'null'] },
        receiptSignatureKid: { type: ['string', 'null'] },
        signatureVerified: { type: 'boolean' },
        anchorSubjectDigest: { type: 'string' },
        anchorSubjectVersion: { type: 'string' },
        anchoredAt: { type: 'string', format: 'date-time' }
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

type ReceiptListRecord = Awaited<ReturnType<typeof prisma.receipt.findMany>>[number];

function normalizeForwardedProto(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim().toLowerCase();
  return first || null;
}

function buildPublicVerificationUrl(request: {
  headers: Record<string, string | string[] | undefined>;
  protocol?: string;
}, receiptId: string): string | null {
  const forwardedProto = normalizeForwardedProto(request.headers['x-forwarded-proto']);
  const hostHeader = request.headers['x-forwarded-host'] || request.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) return null;
  const protocol = forwardedProto || request.protocol || 'https';
  return `${protocol}://${host}/verify/${receiptId}`;
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

function parseReceiptIdParam(
  request: { params: unknown },
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } }
): string | null {
  const parsed = receiptIdParamSchema.safeParse(request.params);
  if (!parsed.success) {
    reply.code(400).send({ error: 'invalid_receipt_id' });
    return null;
  }
  return parsed.data.receiptId;
}

function hasUnexpectedBody(body: unknown): boolean {
  if (typeof body === 'undefined') return false;
  if (body === null) return false;
  if (typeof body !== 'object') return true;
  return Object.keys(body as Record<string, unknown>).length > 0;
}

type BuildServerOptions = {
  fetchImpl?: typeof fetch;
};

export async function buildServer(options: BuildServerOptions = {}) {
  requireProductionVerifierConfig();
  const app = Fastify({
    logger: {
      redact: [
        'req.headers.x-api-key',
        'req.headers.authorization',
        'req.headers.x-issuer-signature',
        'request.headers.x-api-key',
        'request.headers.authorization',
        'request.headers.x-issuer-signature'
      ]
    }
  });
  const securityConfig = buildSecurityConfig();
  const propertyApiKey = resolvePropertyApiKey();
  const verificationEngine = createLocalVerificationEngine({
    prisma,
    securityConfig,
    propertyApiKey,
    fetchImpl: options.fetchImpl
  });
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
  const requireReadScope = requireApiKeyScope(securityConfig, 'read');

  app.addHook('onRequest', async (request) => {
    const timedRequest = request as typeof request & {
      [REQUEST_START]?: number;
    };
    timedRequest[REQUEST_START] = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = (request.routeOptions.url || request.url.split('?')[0] || 'unknown').toString();
    const method = request.method;
    const statusCode = String(reply.statusCode);
    const timedRequest = request as typeof request & {
      [REQUEST_START]?: number;
    };
    const startedAt = timedRequest[REQUEST_START];
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
  let databaseReady = true;
  let databaseInitError: string | null = null;
  try {
    await ensureDatabase(prisma);
  } catch (error) {
    databaseReady = false;
    databaseInitError = error instanceof Error ? error.message : 'database_initialization_failed';
    app.log.error({ err: error }, 'database initialization failed; non-DB routes remain available');
  }

  const dbOptionalRoutes = new Set([
    '/api/v1/health',
    '/api/v1/status',
    '/api/v1/metrics',
    '/api/v1/integrations/vanta/schema'
  ]);

  app.addHook('preHandler', async (request, reply) => {
    if (databaseReady) return;
    const route = (request.routeOptions.url || request.url.split('?')[0] || '').toString();
    if (dbOptionalRoutes.has(route)) return;
    return reply.code(503).send({ error: 'Database unavailable' });
  });

  app.get('/api/v1/health', async () => ({
    status: databaseReady ? 'ok' : 'degraded',
    database: {
      ready: databaseReady,
      initError: databaseInitError
    }
  }));
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
        sslModeRequired: databaseUrlHasRequiredSslMode(process.env.DATABASE_URL),
        ready: databaseReady,
        initError: databaseInitError
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
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const payload = await verificationEngine.getVantaVerificationResult(receiptId);
    if (!payload) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    return reply.send(vantaVerificationResultSchema.parse(payload));
  });

  app.get('/api/v1/registry/sources', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    const sources = await verificationEngine.listRegistrySources();
    return {
      generatedAt: new Date().toISOString(),
      sources
    };
  });

  app.post('/api/v1/registry/verify', {
    preHandler: [requireApiKeyScope(securityConfig, 'verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = registryVerifyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    try {
      const result = await verificationEngine.verifyRegistrySource({
        sourceId: parsed.data.sourceId as RegistrySourceId,
        subject: parsed.data.subjectName,
        forceRefresh: parsed.data.forceRefresh
      });
      return reply.send(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'registry_lookup_failed';
      if (message === 'registry_source_not_found') {
        return reply.code(404).send({ error: 'Registry source not found' });
      }
      return reply.code(502).send({ error: 'Registry source unavailable' });
    }
  });

  app.post('/api/v1/registry/verify-batch', {
    preHandler: [requireApiKeyScope(securityConfig, 'verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = registryVerifyBatchInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    try {
      const result = await verificationEngine.verifyRegistrySources({
        sourceIds: parsed.data.sourceIds as RegistrySourceId[],
        subject: parsed.data.subjectName,
        forceRefresh: parsed.data.forceRefresh
      });
      return reply.send(result);
    } catch {
      return reply.code(502).send({ error: 'Registry sources unavailable' });
    }
  });

  app.get('/api/v1/registry/jobs', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request) => {
    const limitRaw = (request.query as { limit?: string } | undefined)?.limit;
    const parsed = Number.parseInt(limitRaw || '50', 10);
    const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 50;
    const jobs = await verificationEngine.listRegistryOracleJobs(limit);
    return {
      generatedAt: new Date().toISOString(),
      jobs
    };
  });

  app.get('/api/v1/registry/jobs/:jobId', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await verificationEngine.getRegistryOracleJob(jobId);
    if (!job) {
      return reply.code(404).send({ error: 'Registry oracle job not found' });
    }
    return reply.send(job);
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

    return reply.send(await verificationEngine.crossCheckAttom(deed));
  });

  app.post('/api/v1/verify', {
    preHandler: [requireApiKeyScope(securityConfig, 'verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const artifactParsed = artifactVerificationRequestSchema.safeParse(request.body);
    if (artifactParsed.success) {
      try {
        const issued = await issueArtifactReceipt(
          prisma,
          securityConfig,
          artifactParsed.data
        );
        return reply.send(issued);
      } catch (error) {
        request.log.error(
          {
            err: error,
            route: '/api/v1/verify',
            provider: artifactParsed.data.source.provider
          },
          'artifact verification receipt issuance failed'
        );
        return reply.code(503).send({ error: 'Verification unavailable' });
      }
    }

    const parsed = verifyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload' });
    }

    const created = await verificationEngine.createVerification(
      parsed.data as EngineVerificationInput
    );
    const body = toV2VerifyResponse({
      decision: created.receipt.decision,
      reasons: created.receipt.reasons,
      receiptId: created.receipt.receiptId,
      receiptHash: created.receipt.receiptHash,
      receiptSignature: created.receipt.receiptSignature,
      proofVerified:
        created.receipt.zkpAttestation?.status === 'verifiable'
          ? undefined
          : false,
      anchor: created.anchor,
      fraudRisk: created.receipt.fraudRisk,
      zkpAttestation: created.receipt.zkpAttestation,
      revoked: created.revoked,
      riskScore: created.receipt.riskScore
    });

    return reply.send(body);
  });

  app.get('/api/v1/synthetic', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    return verificationEngine.createSyntheticBundle();
  });

  app.get('/api/v1/receipt/:receiptId', {
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const artifactReceipt = await getArtifactReceiptById(prisma, receiptId);
    if (artifactReceipt) {
      return reply.send(
        toArtifactReceiptPublicView(artifactReceipt, {
          verificationUrl: buildPublicVerificationUrl(request, receiptId) || undefined
        })
      );
    }

    if (!request.headers['x-api-key']) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    await requireReadScope(request, reply);
    if (reply.sent) return;

    const storedReceipt = await verificationEngine.getReceipt(receiptId);
    if (!storedReceipt) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    const v2Body = toV2VerifyResponse({
      decision: storedReceipt.receipt.decision,
      reasons: storedReceipt.receipt.reasons,
      receiptId: storedReceipt.receipt.receiptId,
      receiptHash: storedReceipt.receipt.receiptHash,
      receiptSignature: storedReceipt.receipt.receiptSignature,
      proofVerified:
        storedReceipt.receipt.zkpAttestation?.status === 'verifiable'
          ? undefined
          : false,
      anchor: storedReceipt.anchor,
      fraudRisk: storedReceipt.receipt.fraudRisk,
      zkpAttestation: storedReceipt.receipt.zkpAttestation,
      revoked: storedReceipt.revoked,
      riskScore: storedReceipt.receipt.riskScore
    });

    return reply.send({
      ...v2Body,
      receipt: storedReceipt.receipt,
      canonicalReceipt: storedReceipt.canonicalReceipt,
      pdfUrl: `/api/v1/receipt/${receiptId}/pdf`
    });
  });

  app.get('/api/v1/receipt/:receiptId/summary', {
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const artifactReceipt = await getArtifactReceiptById(prisma, receiptId);
    if (!artifactReceipt) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    return reply.send(toArtifactReceiptSummaryView(artifactReceipt));
  });

  app.get('/api/v1/receipt/:receiptId/pdf', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const storedReceipt = await verificationEngine.getReceipt(receiptId);
    if (!storedReceipt) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    const buffer = await renderReceiptPdf(storedReceipt.receipt);
    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename=receipt-${receiptId}.pdf`);
    return reply.send(buffer);
  });

  app.post('/api/v1/receipt/:receiptId/verify', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;

    const body = request.body;
    const hasBody = !(
      typeof body === 'undefined' ||
      body === null ||
      (typeof body === 'object' && Object.keys(body as Record<string, unknown>).length === 0)
    );

    if (hasBody) {
      const parsedArtifactBody = artifactReceiptVerifySchema.safeParse(body);
      if (!parsedArtifactBody.success) {
        return reply.code(400).send({ error: 'Invalid payload' });
      }

      try {
        const verificationResult = await verifyArtifactReceiptById(
          prisma,
          securityConfig,
          receiptId,
          parsedArtifactBody.data.artifact
        );
        if (!verificationResult) {
          return reply.code(404).send({ error: 'Receipt not found' });
        }
        return reply.send(verificationResult);
      } catch (error) {
        request.log.error(
          {
            err: error,
            route: '/api/v1/receipt/:receiptId/verify',
            receiptId
          },
          'artifact receipt verification failed'
        );
        return reply.code(503).send({ error: 'Verification unavailable' });
      }
    }

    const verificationResult = await verificationEngine.getVerificationStatus(
      receiptId
    );
    if (!verificationResult) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    return reply.send(verificationResult);
  });

  app.post('/api/v1/anchor/:receiptId', {
    preHandler: [requireApiKeyScope(securityConfig, 'anchor')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    if (hasUnexpectedBody(request.body)) {
      return reply.code(400).send({ error: 'request_body_not_allowed' });
    }
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const anchorResult = await verificationEngine.anchorReceipt(receiptId);
    if (anchorResult.kind === 'not_found') {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    if (anchorResult.kind === 'proof_artifact_required') {
      return reply.code(409).send({ error: 'proof_artifact_required_for_anchor' });
    }
    return reply.send(anchorResult.anchor);
  });

  app.post('/api/v1/receipt/:receiptId/revoke', {
    preHandler: [requireApiKeyScope(securityConfig, 'revoke')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    if (hasUnexpectedBody(request.body)) {
      return reply.code(400).send({ error: 'request_body_not_allowed' });
    }
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const revocationVerification = verifyRevocationHeaders(request, receiptId, securityConfig);
    if ('error' in revocationVerification) {
      const statusCode = revocationVerification.error === 'issuer_not_allowed' ? 403 : 401;
      return reply.code(statusCode).send({ error: revocationVerification.error });
    }

    const revokeResult = await verificationEngine.revokeReceipt(receiptId);
    if (revokeResult.kind === 'not_found') {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    if (revokeResult.kind === 'already_revoked') {
      return reply.send({ status: 'ALREADY_REVOKED' });
    }

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
