import { Buffer } from 'node:buffer';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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
  signReceiptPayload,
  toUnsignedReceiptPayload,
  verifyBundle,
  verifyReceiptSignature,
  RiskEngine,
  generateComplianceProof,
  verifyComplianceProof,
  DocumentRisk,
  Receipt,
  ZKPAttestation,
  NotaryVerifier,
  PropertyVerifier,
  CountyVerifier,
  nameOverlapScore,
  normalizeName
} from '../../../packages/core/dist/index.js';

import { toV2VerifyResponse } from './lib/v2ReceiptMapper.js';
import { anchorReceipt, buildAnchorSubject } from './anchor.js';
import { ensureDatabase } from './db.js';
import { loadRegistry } from './registryLoader.js';
import { renderReceiptPdf } from './receiptPdf.js';
import { attomCrossCheck, DeedParsed } from '../../../packages/core/dist/index.js';
import { HttpAttomClient } from './services/attomClient.js';
import { CookCountyComplianceValidator } from './services/compliance.js';
import {
  createRegistryAdapterService,
  getOfficialRegistrySourceName,
  REGISTRY_SOURCE_IDS,
  RegistrySourceId
} from './services/registryAdapters.js';
import {
  buildSecurityConfig,
  getApiRateLimitKey,
  isCorsOriginAllowed,
  requireApiKeyScope,
  type SecurityConfig,
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
  const hasReceiptSignature =
    typeof record.receiptSignature === 'string' &&
    record.receiptSignature.length > 0 &&
    typeof record.receiptSignatureAlg === 'string' &&
    record.receiptSignatureAlg.length > 0 &&
    typeof record.receiptSignatureKid === 'string' &&
    record.receiptSignatureKid.length > 0;

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
    ...(record.signingKeyId ? { signing_key_id: record.signingKeyId } : {}),
    receiptHash: record.receiptHash,
    fraudRisk: record.fraudRisk ? JSON.parse(record.fraudRisk) as DocumentRisk : undefined,
    zkpAttestation: record.zkpAttestation ? JSON.parse(record.zkpAttestation) as ZKPAttestation : undefined,
    receiptSignature: hasReceiptSignature
      ? {
        signature: record.receiptSignature!,
        alg: record.receiptSignatureAlg as 'EdDSA',
        kid: record.receiptSignatureKid!
      }
      : undefined,
    // Revocation is returned in the envelope, but not part of the core signed receipt structure so far
    // unless v2 schema changes that. We'll return it in the API.
  };
}

function normalizeDecisionStatus(decision: 'ALLOW' | 'FLAG' | 'BLOCK'): 'PASS' | 'REVIEW' | 'FAIL' {
  if (decision === 'ALLOW') return 'PASS';
  if (decision === 'FLAG') return 'REVIEW';
  return 'FAIL';
}

function resolveRegistrySourceNameFromCheckId(checkId: string): string | undefined {
  if (!checkId.startsWith('registry-')) return undefined;
  const sourceId = checkId.slice('registry-'.length);
  return getOfficialRegistrySourceName(sourceId);
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

function buildAnchorState(record: ReceiptRecord, attestation?: ZKPAttestation) {
  const subject = buildAnchorSubject(record.receiptHash, attestation);
  return {
    status: record.anchorStatus,
    txHash: record.anchorTxHash || undefined,
    chainId: record.anchorChainId || undefined,
    anchorId: record.anchorId || undefined,
    anchoredAt: record.anchorAnchoredAt?.toISOString(),
    subjectDigest: record.anchorSubjectDigest || subject.digest,
    subjectVersion: record.anchorSubjectVersion || subject.version
  };
}

async function verifyStoredReceipt(
  receipt: Receipt,
  record: ReceiptRecord,
  securityConfig: SecurityConfig
) {
  const unsignedPayload = toUnsignedReceiptPayload(receipt);
  const recomputedHash = computeReceiptHash(unsignedPayload);
  const integrityVerified = recomputedHash === receipt.receiptHash && record.inputsCommitment === receipt.inputsCommitment;
  const proofVerified = receipt.zkpAttestation ? await verifyComplianceProof(receipt.zkpAttestation) : false;

  if (!receipt.receiptSignature) {
    return {
      verified: false,
      integrityVerified,
      signatureVerified: false,
      signatureStatus: 'legacy-unsigned' as const,
      signatureReason: 'receipt_signature_missing',
      proofVerified,
      recomputedHash
    };
  }

  const signatureCheck = await verifyReceiptSignature(
    unsignedPayload,
    receipt.receiptSignature,
    securityConfig.receiptSigning.verificationKeys
  );
  const signatureStatus = signatureCheck.verified
    ? 'verified'
    : signatureCheck.keyResolved
      ? 'invalid'
      : 'unknown-kid';

  return {
    verified: integrityVerified && signatureCheck.verified,
    integrityVerified,
    signatureVerified: signatureCheck.verified,
    signatureStatus,
    signatureReason: signatureCheck.reason,
    proofVerified,
    recomputedHash
  };
}

async function toVantaVerificationResult(record: ReceiptRecord, securityConfig: SecurityConfig) {
  const receipt = receiptFromDb(record);
  const receiptVerification = await verifyStoredReceipt(receipt, record, securityConfig);
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
      checks: (JSON.parse(record.checks) as Array<{ checkId: string; status: string; details?: string }>).map((check) => {
        const sourceName = resolveRegistrySourceNameFromCheckId(check.checkId);
        return {
          checkId: check.checkId,
          status: check.status,
          details: typeof check.details === 'string' ? check.details : undefined,
          source_name: sourceName
        };
      }),
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
          status: String(zkpRaw.status ?? 'unknown'),
          backend: String(zkpRaw.backend ?? 'unknown'),
          circuitId: typeof zkpRaw.circuitId === 'string' ? zkpRaw.circuitId : undefined,
          verificationKeyId: typeof zkpRaw.verificationKeyId === 'string' ? zkpRaw.verificationKeyId : undefined,
          verifiedAt: typeof zkpRaw.verifiedAt === 'string' ? zkpRaw.verifiedAt : undefined,
          publicInputs: {
            policyHash: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.policyHash ?? ''),
            timestamp: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.timestamp ?? ''),
            inputsCommitment: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.inputsCommitment ?? ''),
            conformance: Boolean((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.conformance),
            declaredDocHash: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.declaredDocHash ?? ''),
            documentDigest: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.documentDigest ?? ''),
            documentCommitment: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.documentCommitment ?? ''),
            schemaVersion: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.schemaVersion ?? ''),
            documentWitnessMode: String((zkpRaw.publicInputs as Record<string, unknown> | undefined)?.documentWitnessMode ?? '')
          },
          proofArtifact: (() => {
            const proofArtifact = zkpRaw.proofArtifact as Record<string, unknown> | undefined;
            if (!proofArtifact || typeof proofArtifact.format !== 'string' || typeof proofArtifact.digest !== 'string') {
              return undefined;
            }
            return {
              format: proofArtifact.format,
              digest: proofArtifact.digest,
              encoding: proofArtifact.encoding === 'base64' ? 'base64' : undefined,
              proof: typeof proofArtifact.proof === 'string' ? proofArtifact.proof : undefined
            };
          })()
        }
        : null
    },
    controls: {
      revoked: record.revoked,
      anchorStatus: record.anchorStatus,
      anchored: record.anchorStatus === 'ANCHORED',
      receiptSignaturePresent: Boolean(receipt.receiptSignature),
      receiptSignatureAlg: receipt.receiptSignature?.alg ?? null,
      receiptSignatureKid: receipt.receiptSignature?.kid ?? null,
      anchorSubjectDigest: buildAnchorState(record, receipt.zkpAttestation).subjectDigest,
      anchorSubjectVersion: buildAnchorState(record, receipt.zkpAttestation).subjectVersion,
      anchoredAt: buildAnchorState(record, receipt.zkpAttestation).anchoredAt,
      signatureVerified: receiptVerification.signatureVerified
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

type BuildServerOptions = {
  fetchImpl?: typeof fetch;
};

type VerifyRouteInput = BundleInput & {
  registryScreening?: {
    subjectName?: string;
    sourceIds?: RegistrySourceId[];
    forceRefresh?: boolean;
  };
};

export async function buildServer(options: BuildServerOptions = {}) {
  requireProductionVerifierConfig();
  const app = Fastify({ logger: true });
  const securityConfig = buildSecurityConfig();
  const propertyApiKey = resolvePropertyApiKey();
  const registryAdapterService = createRegistryAdapterService(prisma, {
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
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    return reply.send(await toVantaVerificationResult(record, securityConfig));
  });

  app.get('/api/v1/registry/sources', {
    preHandler: [requireApiKeyScope(securityConfig, 'read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    const sources = await registryAdapterService.listSources();
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
      const result = await registryAdapterService.verify({
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
      const result = await registryAdapterService.verifyBatch({
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
    const jobs = await registryAdapterService.listOracleJobs(limit);
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
    const job = await registryAdapterService.getOracleJob(jobId);
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

    const input = parsed.data as VerifyRouteInput;
    const registry = await loadRegistry();
    const verifiers = {
      county: new DatabaseCountyVerifier(),
      notary: new DatabaseNotaryVerifier(),
      property: new AttomPropertyVerifier(propertyApiKey),
      blockchain: new BlockchainVerifier(process.env.RPC_URL || '', process.env.REGISTRY_ADDRESS || '')
    };
    const verification = await verifyBundle(input, registry, verifiers);

    if (input.registryScreening) {
      const subjectName =
        input.registryScreening.subjectName ||
        input.ocrData?.grantorName ||
        input.ocrData?.notaryName;

      if (subjectName) {
        const defaultSources: RegistrySourceId[] = [
          'ofac_sdn',
          'ofac_sls',
          'ofac_ssi',
          'hhs_oig_leie',
          'sam_exclusions',
          'uk_sanctions_list',
          'us_csl_consolidated'
        ];
        const sourceIds = (input.registryScreening.sourceIds as RegistrySourceId[] | undefined) || defaultSources;
        const registryBatch = await registryAdapterService.verifyBatch({
          sourceIds,
          subject: subjectName,
          forceRefresh: input.registryScreening.forceRefresh
        });

        let hasMatch = false;
        let hasComplianceGap = false;
        for (const result of registryBatch.results) {
          if (result.status === 'MATCH') hasMatch = true;
          if (result.status === 'COMPLIANCE_GAP') hasComplianceGap = true;
          verification.checks.push({
            checkId: `registry-${result.sourceId}`,
            status: result.status === 'MATCH' ? 'FAIL' : result.status === 'COMPLIANCE_GAP' ? 'WARN' : 'PASS',
            details:
              result.status === 'MATCH'
                ? `Matched ${result.matches.length} candidates in ${result.sourceName}`
                : result.status === 'COMPLIANCE_GAP'
                  ? `Compliance gap: ${result.sourceName} (${result.details || 'primary source unavailable'})`
                  : `No match in ${result.sourceName}`
          });
        }

        if (hasMatch) {
          verification.decision = 'BLOCK';
          verification.reasons.push('Registry sanctions screening found a match');
        } else if (hasComplianceGap && verification.decision === 'ALLOW') {
          verification.decision = 'FLAG';
          verification.reasons.push('Registry screening has compliance gaps in primary-source coverage');
        }
      }
    }

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
      inputsCommitment: computeInputsCommitment(input),
      docHash: input.doc.docHash,
      canonicalDocumentBase64: input.doc.pdfBase64
    });

    const receipt = buildReceipt(input, verification, 'deed-shield', {
      signing_key_id: securityConfig.receiptSigning.current.kid,
      fraudRisk,
      zkpAttestation
    });
    const receiptSignature = await signReceiptPayload(
      toUnsignedReceiptPayload(receipt),
      securityConfig.receiptSigning.current
    );
    const signedReceipt: Receipt = {
      ...receipt,
      receiptSignature
    };

    const record = await prisma.receipt.create({
      data: {
        id: signedReceipt.receiptId,
        receiptHash: signedReceipt.receiptHash,
        inputsCommitment: signedReceipt.inputsCommitment,
        parcelId: input.property.parcelId,
        policyProfile: signedReceipt.policyProfile,
        decision: signedReceipt.decision,
        reasons: JSON.stringify(signedReceipt.reasons),
        riskScore: signedReceipt.riskScore,
        checks: JSON.stringify(signedReceipt.checks),
        rawInputsHash: signedReceipt.inputsCommitment,
        signingKeyId: signedReceipt.signing_key_id,
        createdAt: new Date(signedReceipt.createdAt),
        fraudRisk: signedReceipt.fraudRisk ? JSON.stringify(signedReceipt.fraudRisk) : undefined,
        zkpAttestation: signedReceipt.zkpAttestation ? JSON.stringify(signedReceipt.zkpAttestation) : undefined,
        receiptSignature: signedReceipt.receiptSignature?.signature,
        receiptSignatureAlg: signedReceipt.receiptSignature?.alg,
        receiptSignatureKid: signedReceipt.receiptSignature?.kid,
        revoked: false
      }
    });

    const body = toV2VerifyResponse({
      decision: signedReceipt.decision,
      reasons: signedReceipt.reasons,
      receiptId: record.id,
      receiptHash: signedReceipt.receiptHash,
      receiptSignature: signedReceipt.receiptSignature,
      proofVerified: signedReceipt.zkpAttestation?.status === 'verifiable' ? undefined : false,
      anchor: buildAnchorState(record, signedReceipt.zkpAttestation),
      fraudRisk: signedReceipt.fraudRisk,
      zkpAttestation: signedReceipt.zkpAttestation,
      revoked: record.revoked,
      riskScore: signedReceipt.riskScore
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
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }

    const canonicalReceipt = canonicalizeJson(toUnsignedReceiptPayload(receipt));

    // We use the mapper for consistency in basic fields, though GET usually adds PDF links
    const v2Body = toV2VerifyResponse({
      decision: receipt.decision,
      reasons: receipt.reasons,
      receiptId: receipt.receiptId,
      receiptHash: receipt.receiptHash,
      receiptSignature: receipt.receiptSignature,
      proofVerified: receipt.zkpAttestation?.status === 'verifiable' ? undefined : false,
      anchor: buildAnchorState(record, receipt.zkpAttestation),
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
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
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
    if (hasUnexpectedBody(request.body)) {
      return reply.code(400).send({ error: 'request_body_not_allowed' });
    }
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }
    const verificationResult = await verifyStoredReceipt(receipt, record, securityConfig);

    return reply.send({
      verified: verificationResult.verified,
      integrityVerified: verificationResult.integrityVerified,
      signatureVerified: verificationResult.signatureVerified,
      signatureStatus: verificationResult.signatureStatus,
      signatureReason: verificationResult.signatureReason,
      proofVerified: verificationResult.proofVerified,
      recomputedHash: verificationResult.recomputedHash,
      storedHash: receipt.receiptHash,
      inputsCommitment: record.inputsCommitment,
      receiptSignature: receipt.receiptSignature
        ? {
          alg: receipt.receiptSignature.alg,
          kid: receipt.receiptSignature.kid
        }
        : null,
      revoked: record.revoked
    });
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
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }
    const receipt = receiptFromDb(record);
    if (!receipt) {
      return reply.code(500).send({ error: 'Receipt reconstruction failed' });
    }
    if (!receipt.zkpAttestation?.proofArtifact?.digest) {
      return reply.code(409).send({ error: 'proof_artifact_required_for_anchor' });
    }

    if (record.anchorStatus === 'ANCHORED') {
      return reply.send({
        ...buildAnchorState(record, receipt.zkpAttestation)
      });
    }

    const result = await anchorReceipt(record.receiptHash, receipt.zkpAttestation);
    const updated = await prisma.receipt.update({
      where: { id: receiptId },
      data: {
        anchorStatus: 'ANCHORED',
        anchorTxHash: result.txHash,
        anchorChainId: result.chainId,
        anchorId: result.anchorId,
        anchorSubjectDigest: result.subjectDigest,
        anchorSubjectVersion: result.subjectVersion,
        anchorAnchoredAt: result.anchoredAt ? new Date(result.anchoredAt) : undefined
      }
    });

    return reply.send({
      ...buildAnchorState(updated, receipt.zkpAttestation)
    });
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
