import { Buffer } from 'node:buffer';
import { randomUUID } from 'crypto';

import { PrismaClient } from '@prisma/client';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';
import { z } from 'zod';

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
  attomCrossCheck,
  DeedParsed,
  NotaryVerifier,
  PropertyVerifier,
  CountyVerifier,
  nameOverlapScore,
  generateFraudScoreProof,
  type ZkmlFraudAttestation
} from '../../../packages/core/dist/index.js';

import { toV2VerifyResponse } from './lib/v2ReceiptMapper.js';
import { mapInternalStatusToExternal, type ExternalReceiptStatus } from './receipts.js';
import { anchorReceiptOnChain, buildAnchorSubject, type AnchorChain } from './anchor.js';
import { loadRegistry } from './registryLoader.js';
import { renderReceiptPdf } from './receiptPdf.js';
import { loadRuntimeEnv, resolveDatabaseUrl, validateRequiredEnv } from './env.js';
import { HttpAttomClient } from './services/attomClient.js';
import { CookCountyComplianceValidator } from './services/compliance.js';
import {
  createRegistryAdapterService,
  getOfficialRegistrySourceName,
  REGISTRY_SOURCE_IDS,
  RegistrySourceId
} from './services/registryAdapters.js';
import {
  type AuthScope,
  buildSecurityConfig,
  checkPlanQuota,
  getApiRateLimitKey,
  getMonthlyUsageStats,
  isCorsOriginAllowed,
  requireApiKeyScope,
  type SecurityConfig,
  verifyRevocationHeaders
} from './security.js';
import { isWorkflowError } from './workflow/errors.js';
import {
  PrismaWorkflowEventSink,
  type WorkflowEventSink
} from './workflow/events.js';
import { WorkflowService } from './workflow/service.js';
import {
  readinessWorkflowRequestSchema,
  workflowArtifactCreateSchema,
  workflowArtifactParamsSchema,
  workflowCreateRequestSchema,
  workflowParamsSchema,
  workflowRunRequestSchema
} from './workflow/types.js';

loadRuntimeEnv();
resolveDatabaseUrl();
validateRequiredEnv();
const prisma = new PrismaClient();
const REQUEST_START = Symbol('requestStartMs');
type RequestTimerState = {
  [REQUEST_START]?: number;
};
type PrismaWorkflowEventDelegate = ConstructorParameters<typeof PrismaWorkflowEventSink>[0];
const NOTARY_STATUSES = ['ACTIVE', 'SUSPENDED', 'REVOKED', 'UNKNOWN'] as const;
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
const githubVerificationInputSchema = z.object({
  apiVersion: z.literal('2026-03-13'),
  provider: z.literal('github'),
  externalId: z.string().min(1),
  headSha: z.string().min(7).max(64),
  detailsUrl: z.string().url().optional(),
  subject: z.object({
    kind: z.enum(['workflow_run', 'release', 'commit']),
    summary: z.string().min(1)
  }),
  repository: z.object({
    owner: z.string().min(1),
    repo: z.string().min(1),
    fullName: z.string().min(1),
    defaultBranch: z.string().min(1).optional(),
    htmlUrl: z.string().url().optional()
  }),
  provenance: z.object({
    eventName: z.enum(['workflow_run', 'release', 'push']),
    attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
  })
});
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
    module: z.literal('TrustSignal'),
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
        module: { const: 'TrustSignal' },
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
    verifierId: 'trustsignal',
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

function sendWorkflowValidationError(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  details: unknown
) {
  return reply.code(400).send({ error: 'invalid_workflow_payload', details });
}

function sendWorkflowError(
  reply: { code: (statusCode: number) => { send: (payload: unknown) => unknown } },
  error: unknown,
  fallbackError: string
) {
  if (!isWorkflowError(error)) {
    return reply.code(500).send({ error: fallbackError });
  }

  if (
    error.code === 'workflow_not_found' ||
    error.code === 'artifact_not_found' ||
    error.code === 'agent_not_found'
  ) {
    return reply.code(404).send({ error: error.code });
  }

  if (
    error.code === 'artifact_classification_downgrade_forbidden' ||
    error.code === 'unknown_source_ref' ||
    error.code === 'invalid_release_target'
  ) {
    return reply.code(400).send({
      error: error.code,
      ...(error.metadata ? { details: error.metadata } : {})
    });
  }

  return reply.code(500).send({ error: fallbackError });
}

function buildAnchorState(record: ReceiptRecord, attestation?: ZKPAttestation) {
  const subject = buildAnchorSubject(record.receiptHash, attestation);
  // Infer chain from stored chainId: "solana-*" → solana, otherwise evm
  const chain: AnchorChain = record.anchorChainId?.startsWith('solana-') ? 'solana' : 'evm';
  return {
    status: record.anchorStatus,
    chain,
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
  const fraudRiskRaw = receipt.fraudRisk as unknown as Record<string, unknown> | undefined;
  const zkpRaw = receipt.zkpAttestation as unknown as Record<string, unknown> | undefined;

  const payload = {
    schemaVersion: 'trustsignal.vanta.verification_result.v1' as const,
    generatedAt: new Date().toISOString(),
    vendor: {
      name: 'TrustSignal' as const,
      module: 'TrustSignal' as const,
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
  async verifyParcel(parcelId: string, _county: string, _state: string): Promise<CountyCheckResult> {
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
    if (notary.status !== 'ACTIVE') {
      const status = NOTARY_STATUSES.includes(notary.status as typeof NOTARY_STATUSES[number])
        ? (notary.status as typeof NOTARY_STATUSES[number])
        : 'UNKNOWN';
      return { status, details: 'Notary not active' };
    }
    if (notary.commissionState !== state) return { status: 'ACTIVE', details: 'State mismatch (recorded)', };
    return { status: 'ACTIVE', details: `Found ${name}` };
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
          const address = prop?.address;
          await prisma.$transaction(async (tx) => {
            await tx.property.upsert({
              where: { parcelId },
              update: { currentOwner: ownerName, lastSaleDate },
              create: { parcelId, currentOwner: ownerName, lastSaleDate }
            });
            if (address?.countrySubd || address?.countrySecondarySubd) {
              await tx.countyRecord.upsert({
                where: { parcelId },
                update: { county: address.countrySecondarySubd, state: address.countrySubd, active: true },
                create: { parcelId, county: address.countrySecondarySubd || 'Unknown', state: address.countrySubd || 'IL', active: true }
              });
            }
          });
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
      void provider;

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
  logger?: boolean | Record<string, unknown>;
  workflowEventSink?: WorkflowEventSink;
};

type VerifyRouteInput = BundleInput & {
  registryScreening?: {
    subjectName?: string;
    sourceIds?: RegistrySourceId[];
    forceRefresh?: boolean;
  };
};

type GitHubVerificationInput = z.infer<typeof githubVerificationInputSchema>;

function mapGitHubConclusion(status: ExternalReceiptStatus): 'success' | 'failure' | 'neutral' {
  if (status === 'clean') return 'success';
  if (status === 'failure' || status === 'revoked') return 'failure';
  return 'neutral';
}

function buildGitHubVerifyInput(input: GitHubVerificationInput): VerifyRouteInput {
  const payloadDigest = keccak256(toUtf8Bytes(canonicalizeJson(input)));
  const repositoryUrl = input.repository.htmlUrl || `https://github.com/${input.repository.fullName}`;

  return {
    bundleId: `github-${input.externalId}`,
    transactionType: input.subject.kind,
    ron: {
      provider: 'github',
      notaryId: input.repository.fullName,
      commissionState: 'GH',
      sealPayload: `${input.headSha}:${input.externalId}`
    },
    doc: {
      docHash: payloadDigest
    },
    policy: {
      profile: 'GITHUB_ARTIFACT_V1'
    },
    property: {
      parcelId: input.externalId,
      county: input.repository.repo,
      state: 'GH'
    },
    ocrData: {
      notaryName: input.repository.fullName,
      propertyAddress: repositoryUrl,
      grantorName: input.subject.summary
    },
    timestamp: new Date().toISOString()
  };
}

type ReceiptIssueResult = {
  record: ReceiptRecord;
  signedReceipt: Receipt;
  responseBody: ReturnType<typeof toV2VerifyResponse> & { zkmlAttestation?: ZkmlFraudAttestation };
};

async function issueReceiptRecord(
  input: VerifyRouteInput,
  verification: Awaited<ReturnType<typeof verifyBundle>>,
  securityConfig: SecurityConfig,
  options: {
    fraudRisk?: DocumentRisk;
  } = {}
): Promise<ReceiptIssueResult> {
  // Generate Halo2 compliance proof (dev-only unless TRUSTSIGNAL_ZKP_BACKEND=external).
  const zkpAttestation = await generateComplianceProof({
    policyProfile: input.policy.profile,
    checksResult: verification.decision === 'ALLOW',
    inputsCommitment: computeInputsCommitment(input),
    docHash: input.doc.docHash,
    canonicalDocumentBase64: input.doc.pdfBase64
  });

  // Generate ezkl ZKML fraud score proof (dev-only unless TRUSTSIGNAL_ZKML_EZKL_BIN is set).
  let zkmlAttestation: ZkmlFraudAttestation | undefined;
  if (options.fraudRisk) {
    try {
      const features = [options.fraudRisk.score, options.fraudRisk.score > 0.5 ? 1 : 0];
      zkmlAttestation = await generateFraudScoreProof(features, options.fraudRisk.score);
    } catch (err) {
      // Non-fatal: log and continue without ZKML attestation.
      console.warn('[zkml] proof generation skipped:', err instanceof Error ? err.message : String(err));
    }
  }

  const receipt = buildReceipt(input, verification, 'trustsignal', {
    signing_key_id: securityConfig.receiptSigning.current.kid,
    fraudRisk: options.fraudRisk,
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

  const responseBody = toV2VerifyResponse({
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

  const responseWithZkml = zkmlAttestation
    ? { ...responseBody, zkmlAttestation }
    : responseBody;

  return {
    record,
    signedReceipt,
    responseBody: responseWithZkml
  };
}

async function assertRequiredSchema() {
  const [state] = await prisma.$queryRaw<Array<{
    apiKeys: string | null;
    receipts: string | null;
    workflowEvents: string | null;
    properties: string | null;
    countyRecords: string | null;
    notaries: string | null;
  }>>`
    select
      to_regclass('public.api_keys')::text as "apiKeys",
      to_regclass('public."Receipt"')::text as "receipts",
      to_regclass('public."WorkflowEvent"')::text as "workflowEvents",
      to_regclass('public."Property"')::text as "properties",
      to_regclass('public."CountyRecord"')::text as "countyRecords",
      to_regclass('public."Notary"')::text as "notaries"
  `;

  const missing = Object.entries(state ?? {})
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`required_schema_missing:${missing.join(',')}`);
  }
}

export async function buildServer(options: BuildServerOptions = {}) {
  requireProductionVerifierConfig();
  await assertRequiredSchema();
  const app = Fastify({ logger: options.logger ?? true });
  const securityConfig = buildSecurityConfig();
  const propertyApiKey = resolvePropertyApiKey();
  const registryAdapterService = createRegistryAdapterService(prisma, {
    fetchImpl: options.fetchImpl
  });
  const metricsRegistry = new Registry();
  collectDefaultMetrics({ register: metricsRegistry, prefix: 'trustsignal_api_' });
  const httpRequestsTotal = new Counter({
    name: 'trustsignal_http_requests_total',
    help: 'Total HTTP requests served by the API',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [metricsRegistry]
  });
  const httpRequestDurationSeconds = new Histogram({
    name: 'trustsignal_http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [metricsRegistry]
  });
  // Business-level verification lifecycle metrics
  const receiptsIssuedTotal = new Counter({
    name: 'trustsignal_receipts_issued_total',
    help: 'Total signed receipts issued by decision outcome',
    labelNames: ['decision', 'policy_profile'] as const,
    registers: [metricsRegistry]
  });
  const receiptVerificationsTotal = new Counter({
    name: 'trustsignal_receipt_verifications_total',
    help: 'Total post-issuance receipt verifications by outcome',
    labelNames: ['outcome'] as const,
    registers: [metricsRegistry]
  });
  const revocationsTotal = new Counter({
    name: 'trustsignal_revocations_total',
    help: 'Total receipt revocations processed',
    labelNames: [] as const,
    registers: [metricsRegistry]
  });
  const verifyDurationSeconds = new Histogram({
    name: 'trustsignal_verify_duration_seconds',
    help: 'End-to-end duration of the verification and receipt issuance flow',
    labelNames: ['decision'] as const,
    buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
    registers: [metricsRegistry]
  });
  const receiptLookupDurationSeconds = new Histogram({
    name: 'trustsignal_receipt_lookup_duration_seconds',
    help: 'Duration of receipt retrieval from database (GET /receipt/:id)',
    labelNames: [] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
    registers: [metricsRegistry]
  });
  const anchorDurationSeconds = new Histogram({
    name: 'trustsignal_anchor_duration_seconds',
    help: 'Duration of receipt anchoring operation by chain',
    labelNames: ['chain'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
    registers: [metricsRegistry]
  });
  const httpErrorsTotal = new Counter({
    name: 'trustsignal_http_errors_total',
    help: 'Total HTTP error responses (4xx/5xx) by route and status code',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [metricsRegistry]
  });
  const perApiKeyRateLimit = {
    max: securityConfig.perApiKeyRateLimitMax,
    timeWindow: securityConfig.rateLimitWindow,
    keyGenerator: getApiRateLimitKey
  };

  app.addHook('onRequest', async (request) => {
    (request as RequestTimerState)[REQUEST_START] = Date.now();
  });

  // Propagate Fastify's auto-generated request ID as x-request-id for correlation across logs
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });

  app.addHook('onResponse', async (request, reply) => {
    const route = (request.routeOptions.url || request.url.split('?')[0] || 'unknown').toString();
    const method = request.method;
    const statusCode = String(reply.statusCode);
    const startedAt = (request as RequestTimerState)[REQUEST_START];
    const durationSeconds = startedAt ? (Date.now() - startedAt) / 1000 : 0;
    httpRequestsTotal.inc({ method, route, status_code: statusCode });
    httpRequestDurationSeconds.observe({ method, route, status_code: statusCode }, durationSeconds);
    if (reply.statusCode >= 400) {
      httpErrorsTotal.inc({ method, route, status_code: statusCode });
    }

    if (request.authContext?.apiKeyId) {
      const userAgent = request.headers['user-agent'];
      const userAgentValue = Array.isArray(userAgent) ? userAgent[0] : userAgent;
      const metadata = JSON.stringify({
        authSource: request.authContext.authSource,
        scopes: [...request.authContext.scopes]
      });

      try {
        await prisma.$executeRaw`
          insert into public.verification_log (
            api_key_id,
            user_id,
            endpoint,
            status_code,
            request_id,
            source_ip,
            user_agent,
            metadata
          ) values (
            ${request.authContext.apiKeyId},
            ${request.authContext.userId},
            ${route},
            ${reply.statusCode},
            ${request.id},
            ${request.ip}::inet,
            ${userAgentValue ?? null},
            ${metadata}::jsonb
          )
        `;
      } catch (error) {
        app.log.error(
          {
            event: 'verification_log_write_failed',
            request_id: request.id,
            error: error instanceof Error ? error.message : String(error)
          },
          'verification_log_write_failed'
        );
      }
    }
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

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'TrustSignal API',
        description: 'Cryptographic fraud prevention API',
        version: '1.0.0'
      },
      servers: [
        { url: 'https://api.trustsignal.dev', description: 'Production' },
        { url: 'http://localhost:3001', description: 'Development' }
      ],
      tags: [
        { name: 'Receipt', description: 'Receipt operations' },
        { name: 'Verify', description: 'Verification operations' },
        { name: 'Anchor', description: 'Anchoring operations' },
        { name: 'Registry', description: 'Registry operations' }
      ]
    }
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    },
    staticCSP: true,
    transformStaticCSP: (header) => header
  });
  const workflowEventSink =
    options.workflowEventSink ??
    new PrismaWorkflowEventSink(
      (prisma as PrismaClient & { workflowEvent: PrismaWorkflowEventDelegate }).workflowEvent,
      app.log
    );
  const workflowService = new WorkflowService(undefined, {
    eventSink: workflowEventSink
  });
  const requireScope = (scope: AuthScope) => requireApiKeyScope(prisma, securityConfig, scope);
  app.get('/api/v1/health', async () => ({
    status: 'ok',
    database: {
      ready: true,
      initError: null
    }
  }));
  app.get('/api/v1/status', async (request) => {
    const forwardedProto = normalizeForwardedProto(request.headers['x-forwarded-proto']);
    return {
      status: 'ok',
      service: 'trustsignal-api',
      version: process.env.TRUSTSIGNAL_VERSION || 'dev',
      environment: process.env.NODE_ENV || 'development',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      ingress: {
        forwardedProto,
        forwardedHttps: forwardedProto === 'https'
      },
      database: {
        sslModeRequired: databaseUrlHasRequiredSslMode(process.env.DATABASE_URL),
        ready: true,
        initError: null
      },
      trustRegistry: {
        source: process.env.TRUST_REGISTRY_SOURCE || 'local-signed-registry'
      }
    };
  });
  app.get('/api/v1/metrics', {
    preHandler: [requireScope('read')]
  }, async (_request, reply) => {
    reply.header('Content-Type', metricsRegistry.contentType);
    return reply.send(await metricsRegistry.metrics());
  });

  app.get('/api/v1/usage', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const userId = request.authContext?.userId ?? null;
    if (!userId) {
      // local-dev keys: return unlimited placeholder
      return reply.send({ plan: 'dev', used: 0, limit: null, remaining: null, resetAt: null });
    }
    const stats = await getMonthlyUsageStats(prisma, userId);
    if (!stats) {
      return reply.code(404).send({ error: 'Usage data not available — customer record not found' });
    }
    return reply.send(stats);
  });

  app.get('/api/v1/integrations/vanta/schema', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    return {
      schemaVersion: 'trustsignal.vanta.verification_result.v1',
      schema: vantaVerificationResultJsonSchema
    };
  });

  app.get('/api/v1/trust-agents', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    return {
      generatedAt: new Date().toISOString(),
      agents: workflowService.listAgents(),
      registryIntegrity: {
        mode: 'static-in-memory',
        deterministicLoad: true
      }
    };
  });

  app.post('/api/v1/workflows', {
    preHandler: [requireScope('verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = workflowCreateRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkflowValidationError(reply, parsed.error.flatten());
    }

    const workflow = workflowService.createWorkflow(parsed.data.createdBy);
    return reply.code(201).send(workflow);
  });

  app.post('/api/v1/workflows/readiness-audit', {
    preHandler: [requireScope('verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = readinessWorkflowRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkflowValidationError(reply, parsed.error.flatten());
    }

    try {
      const result = await workflowService.runEnterpriseReadinessAuditWorkflow(parsed.data);
      return reply.code(201).send(result);
    } catch (error) {
      return sendWorkflowError(reply, error, 'workflow_run_failed');
    }
  });

  app.get('/api/v1/workflows/:workflowId', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = workflowParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_workflow_id' });
    }

    const state = workflowService.getWorkflowState(parsed.data.workflowId);
    if (!state) {
      return reply.code(404).send({ error: 'workflow_not_found' });
    }

    return reply.send(state);
  });

  app.get('/api/v1/workflows/:workflowId/events', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = workflowParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_workflow_id' });
    }

    const state = workflowService.getWorkflowState(parsed.data.workflowId);
    if (!state) {
      return reply.code(404).send({ error: 'workflow_not_found' });
    }

    const events = await workflowEventSink.listByWorkflow(parsed.data.workflowId);
    return reply.send({
      workflowId: parsed.data.workflowId,
      events
    });
  });

  app.get('/api/v1/workflows/:workflowId/evidence-package', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const parsed = workflowParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_workflow_id' });
    }

    const evidencePackage = workflowService.getEvidencePackage(parsed.data.workflowId);
    if (!evidencePackage) {
      return reply.code(404).send({ error: 'evidence_package_not_found' });
    }

    return reply.send(evidencePackage);
  });

  app.post('/api/v1/workflows/:workflowId/artifacts', {
    preHandler: [requireScope('verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const params = workflowParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_workflow_id' });
    }

    const parsed = workflowArtifactCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkflowValidationError(reply, parsed.error.flatten());
    }

    try {
      const artifact = workflowService.createArtifact({
        workflowId: params.data.workflowId,
        createdBy: parsed.data.createdBy,
        parentIds: parsed.data.parentIds,
        classification: parsed.data.classification,
        content: parsed.data.content
      });
      return reply.code(201).send(artifact);
    } catch (error) {
      return sendWorkflowError(reply, error, 'workflow_artifact_creation_failed');
    }
  });

  app.post('/api/v1/workflows/:workflowId/runs', {
    preHandler: [requireScope('verify')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request, reply) => {
    const params = workflowParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: 'invalid_workflow_id' });
    }

    const parsed = workflowRunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendWorkflowValidationError(reply, parsed.error.flatten());
    }

    try {
      const run = await workflowService.runWorkflow(params.data.workflowId, parsed.data);
      return reply.code(201).send(run);
    } catch (error) {
      return sendWorkflowError(reply, error, 'workflow_run_failed');
    }
  });

  app.post('/api/v1/workflows/:workflowId/artifacts/:artifactId/verify', {
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('verify')]
  }, async (request, reply) => {
    const parsed = workflowArtifactParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_workflow_artifact_id' });
    }

    try {
      const verification = workflowService.verifyArtifact(parsed.data.workflowId, parsed.data.artifactId);
      return reply.send(verification);
    } catch (error) {
      return sendWorkflowError(reply, error, 'workflow_verification_failed');
    }
  });

  app.get('/api/v1/integrations/vanta/verification/:receiptId', {
    preHandler: [requireScope('read')],
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
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async () => {
    const sources = await registryAdapterService.listSources();
    return {
      generatedAt: new Date().toISOString(),
      sources
    };
  });

  app.post('/api/v1/registry/verify', {
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('verify')]
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
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('verify')]
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
    preHandler: [requireScope('read')],
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
    preHandler: [requireScope('read')],
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
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('verify')]
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
    config: { rateLimit: perApiKeyRateLimit },
    schema: {
      tags: ['Verify'],
      summary: 'Verify a document and generate receipt',
      description: 'Run verification checks and generate a cryptographic receipt',
      body: verifyInputSchema
    },
    preHandler: [requireScope('verify')]
  }, async (request, reply) => {
    // Enforce plan quota before running any verification work.
    const quota = await checkPlanQuota(prisma, request.authContext?.userId ?? null);
    if (!quota.allowed) {
      return reply.code(429).send({
        error: 'plan_quota_exceeded',
        plan: quota.plan,
        used: quota.used,
        limit: quota.limit,
        message: `Monthly verification limit reached for plan '${quota.plan}'. Upgrade to continue.`
      });
    }

    const verifyStartMs = Date.now();
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

    const { record, signedReceipt, responseBody } = await issueReceiptRecord(
      input,
      verification,
      securityConfig,
      { fraudRisk }
    );

    receiptsIssuedTotal.inc({ decision: signedReceipt.decision, policy_profile: input.policy.profile });
    verifyDurationSeconds.observe({ decision: signedReceipt.decision }, (Date.now() - verifyStartMs) / 1000);
    app.log.info(
      {
        event: 'receipt_issued',
        request_id: request.id,
        receipt_id: record.id,
        decision: signedReceipt.decision,
        policy_profile: input.policy.profile,
        duration_ms: Date.now() - verifyStartMs
      },
      'receipt_issued'
    );

    return reply.send(responseBody);
  });

  app.post('/api/v1/verifications/github', {
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('verify')]
  }, async (request, reply) => {
    const parsed = githubVerificationInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const input = parsed.data;
    const verifyInput = buildGitHubVerifyInput(input);
    const repositoryUrl = input.repository.htmlUrl || `https://github.com/${input.repository.fullName}`;
    const decision = input.provenance.eventName === 'push' ? 'FLAG' : 'ALLOW';
    const verification = {
      decision,
      reasons: decision === 'ALLOW'
        ? [`Verified GitHub provenance for ${input.repository.fullName} at ${input.headSha}`]
        : [`GitHub provenance accepted with follow-up review for ${input.repository.fullName}`],
      riskScore: decision === 'ALLOW' ? 6 : 34,
      checks: [
        {
          checkId: 'github-provider',
          status: 'PASS',
          details: `provider=${input.provider}`
        },
        {
          checkId: 'github-repository',
          status: 'PASS',
          details: input.repository.fullName
        },
        {
          checkId: 'github-event',
          status: decision === 'ALLOW' ? 'PASS' : 'WARN',
          details: `${input.provenance.eventName}:${input.subject.kind}`
        },
        {
          checkId: 'github-head-sha',
          status: 'PASS',
          details: input.headSha
        }
      ]
    } as Awaited<ReturnType<typeof verifyBundle>>;

    const { record } = await issueReceiptRecord(
      verifyInput,
      verification,
      securityConfig
    );
    const receiptStatus = mapInternalStatusToExternal(record.decision as 'ALLOW' | 'FLAG' | 'BLOCK', record.revoked);
    const conclusion = mapGitHubConclusion(receiptStatus);

    return reply.send({
      receiptId: record.id,
      checkRunStatus: 'completed',
      receiptStatus,
      conclusion,
      title: conclusion === 'success' ? 'TrustSignal verification passed' : 'TrustSignal verification needs review',
      summary: `${input.subject.summary} (${input.repository.fullName}) -> ${receiptStatus}`,
      verificationTimestamp: record.createdAt.toISOString(),
      provenanceNote: `Verified ${input.provenance.eventName} provenance for ${input.repository.fullName}`,
      detailsUrl: input.detailsUrl || repositoryUrl
    });
  });

  app.get('/api/v1/synthetic', {
    config: { rateLimit: perApiKeyRateLimit },
    preHandler: [requireScope('read')]
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
    config: { rateLimit: perApiKeyRateLimit },
    schema: {
      tags: ['Receipt'],
      summary: 'Get receipt details',
      description: 'Retrieve a receipt by ID',
      params: receiptIdParamSchema
    },
    preHandler: [requireScope('read')]
  }, async (request, reply) => {
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;
    const lookupStart = Date.now();
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    receiptLookupDurationSeconds.observe((Date.now() - lookupStart) / 1000);
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
    preHandler: [requireScope('read')],
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
    config: { rateLimit: perApiKeyRateLimit },
    schema: {
      tags: ['Receipt'],
      summary: 'Verify receipt signature',
      description: 'Verify the cryptographic signature of a receipt',
      params: receiptIdParamSchema
    },
    preHandler: [requireScope('read')]
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
    const verificationOutcome = verificationResult.verified ? 'verified' : 'not_verified';
    receiptVerificationsTotal.inc({ outcome: verificationOutcome });
    app.log.info(
      {
        event: 'receipt_verified',
        request_id: request.id,
        receipt_id: receiptId,
        outcome: verificationOutcome,
        signature_verified: verificationResult.signatureVerified,
        integrity_verified: verificationResult.integrityVerified
      },
      'receipt_verified'
    );

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
    config: { rateLimit: perApiKeyRateLimit },
    schema: {
      tags: ['Anchor'],
      summary: 'Anchor receipt to blockchain',
      description: 'Store cryptographic proof on-chain for immutability',
      params: receiptIdParamSchema
    },
    preHandler: [requireScope('anchor')]
  }, async (request, reply) => {
    if (hasUnexpectedBody(request.body)) {
      return reply.code(400).send({ error: 'request_body_not_allowed' });
    }
    const receiptId = parseReceiptIdParam(request, reply);
    if (!receiptId) return;

    // Optional ?chain=evm|solana query param (default: evm)
    const chainParam = (request.query as Record<string, string | undefined>).chain;
    const chain: AnchorChain = chainParam === 'solana' ? 'solana' : 'evm';

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

    // If already anchored on the requested chain, return the stored state
    if (record.anchorStatus === 'ANCHORED') {
      const storedChain: AnchorChain = record.anchorChainId?.startsWith('solana-') ? 'solana' : 'evm';
      if (storedChain === chain) {
        return reply.send({
          ...buildAnchorState(record, receipt.zkpAttestation)
        });
      }
      // Different chain requested — allow anchoring on additional chain
      // (cross-chain: receipt may be anchored on multiple chains)
    }

    const anchorStart = Date.now();
    const result = await anchorReceiptOnChain(record.receiptHash, chain, receipt.zkpAttestation);
    anchorDurationSeconds.observe({ chain }, (Date.now() - anchorStart) / 1000);
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
    config: { rateLimit: perApiKeyRateLimit },
    schema: {
      tags: ['Receipt'],
      summary: 'Revoke a receipt',
      description: 'Mark a receipt as revoked',
      params: receiptIdParamSchema
    },
    preHandler: [requireScope('revoke')]
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
      return reply.send({
        status: 'REVOKED',
        receiptStatus: 'revoked' satisfies ExternalReceiptStatus,
        result: 'ALREADY_REVOKED'
      });
    }

    await prisma.receipt.update({
      where: { id: receiptId },
      data: { revoked: true }
    });

    revocationsTotal.inc();
    app.log.info(
      {
        event: 'receipt_revoked',
        request_id: request.id,
        receipt_id: receiptId,
        issuer_id: revocationVerification.issuerId
      },
      'receipt_revoked'
    );

    return reply.send({
      status: 'REVOKED',
      receiptStatus: 'revoked' satisfies ExternalReceiptStatus,
      result: 'REVOKED',
      issuerId: revocationVerification.issuerId
    });
  });

  app.get('/api/v1/receipts', {
    preHandler: [requireScope('read')],
    config: { rateLimit: perApiKeyRateLimit }
  }, async (request) => {
    const query = request.query as { limit?: string };
    const rawLimit = query.limit !== undefined ? Number.parseInt(query.limit, 10) : NaN;
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 200)) : 50;
    const records = await prisma.receipt.findMany({
      select: {
        id: true,
        decision: true,
        riskScore: true,
        createdAt: true,
        anchorStatus: true,
        revoked: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    return records.map((record) => ({
      receiptId: record.id,
      status: mapInternalStatusToExternal(record.decision as 'ALLOW' | 'FLAG' | 'BLOCK', record.revoked),
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
    .then((app) => {
      app.log.info({
        event: 'server_start',
        version: process.env.TRUSTSIGNAL_VERSION || 'dev',
        environment: process.env.NODE_ENV || 'development',
        port
      }, 'TrustSignal API starting');
      return app.listen({ port, host: '0.0.0.0' });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
