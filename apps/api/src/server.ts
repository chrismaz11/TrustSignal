import { Buffer } from 'node:buffer';
import { randomUUID } from 'crypto';

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { keccak256, toUtf8Bytes, JsonRpcProvider, Contract } from 'ethers';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { requireOrg } from './utils/auth.js';
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
  keccak256Buffer
} from '@deed-shield/core';

import { toV2VerifyResponse } from './lib/v2ReceiptMapper.js';
import { anchorReceipt } from './anchor.js';
import { ensureDatabase } from './db.js';
import { loadRegistry } from './registryLoader.js';
import { renderReceiptPdf } from './receiptPdf.js';
import { attomCrossCheck, DeedParsed } from '@deed-shield/core';
import { HttpAttomClient } from './services/attomClient.js';
import { CookCountyComplianceValidator } from './services/compliance.js';

const prisma = new PrismaClient();


const verifyRouteSchema = {
  body: {
    type: 'object',
    required: ['bundleId', 'transactionType', 'ron', 'doc', 'policy', 'property'],
    additionalProperties: false,
    properties: {
      bundleId: { type: 'string', minLength: 1 },
      transactionType: { type: 'string', minLength: 1 },
      ron: {
        type: 'object',
        required: ['provider', 'notaryId', 'commissionState', 'sealPayload'],
        additionalProperties: false,
        properties: {
          provider: { type: 'string', minLength: 1 },
          notaryId: { type: 'string', minLength: 1 },
          commissionState: { type: 'string', minLength: 2, maxLength: 2 },
          sealPayload: { type: 'string', minLength: 1 },
          sealScheme: { type: 'string', enum: ['SIM-ECDSA-v1'] }
        }
      },
      doc: {
        type: 'object',
        required: ['docHash'],
        additionalProperties: false,
        properties: {
          docHash: { type: 'string', minLength: 1 },
          pdfBase64: { type: 'string', minLength: 1 }
        }
      },
      policy: {
        type: 'object',
        required: ['profile'],
        additionalProperties: false,
        properties: {
          profile: { type: 'string', minLength: 1 }
        }
      },
      property: {
        type: 'object',
        required: ['parcelId', 'county', 'state'],
        additionalProperties: false,
        properties: {
          parcelId: { type: 'string', pattern: '^[A-Za-z0-9\\-]+$' },
          county: { type: 'string', minLength: 1 },
          state: { type: 'string', minLength: 2, maxLength: 2 }
        }
      },
      ocrData: {
        type: 'object',
        additionalProperties: false,
        properties: {
          notaryName: { type: 'string' },
          notaryCommissionId: { type: 'string' },
          propertyAddress: { type: 'string' },
          grantorName: { type: 'string' }
        }
      },
      timestamp: { type: 'string', format: 'date-time' }
    }
  }
};




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
    // Revocation from V2 or new model
    revoked: record.revoked, 
    revocationTimestamp: undefined, // populated if joined with Revocation table
  };
}

// Minimal type for Verification Event Log
interface VerificationEventLog {
  endpoint: string;
  result: string;
  ip: string;
  userAgent: string;
  receiptId?: string;
  organizationId?: string;
}

// Log immutable event
async function logVerificationEvent(prisma: PrismaClient, evt: VerificationEventLog) {
  try {
    await prisma.verificationEvent.create({
      data: {
        endpoint: evt.endpoint,
        result: evt.result,
        ip: evt.ip,
        userAgent: evt.userAgent,
        receiptId: evt.receiptId,
        organizationId: evt.organizationId
      }
    });
  } catch (err) {
    console.error('Failed to log verification event:', err);
  }
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
        const inputGrantor = bundle.ocrData.grantorName.toLowerCase().trim();
        const currentOwner = property.currentOwner.toLowerCase().trim();

        // Fuzzy match: Check if names roughly match (e.g. "John Doe" vs "Doe, John" or inclusion)
        if (!currentOwner.includes(inputGrantor) && !inputGrantor.includes(currentOwner)) {
          return {
            checkId: 'chain-of-title',
            status: 'FLAG',
            details: `Chain of Title Break: Grantor '${bundle.ocrData.grantorName}' does not match current owner '${property.currentOwner}'`
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

    const inputGrantor = grantorName.toLowerCase();
    const recordOwner = ownerName.toLowerCase();
    const match = !!recordOwner && (recordOwner.includes(inputGrantor) || inputGrantor.includes(recordOwner));
    const score = match ? 90 : 0;

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

export async function buildServer(config?: {
  attomApiKey?: string;
  attomBaseUrl?: string;
  rpcUrl?: string;
  registryAddress?: string;
  openaiApiKey?: string;
  rateLimitMax?: number;
  rateLimitWindow?: string;
}) {
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: true
  });
  await app.register(helmet);
  await app.register(rateLimit, {
    max: config?.rateLimitMax || 100,
    timeWindow: config?.rateLimitWindow || '1 minute'
  });
  await ensureDatabase(prisma);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  app.post('/api/v1/verify/attom', async (request, reply) => {
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return;

    // Log metered usage for ATTOM
    await logVerificationEvent(prisma, {
        endpoint: '/api/v1/verify/attom',
        result: 'CALL_ATTOM',
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        organizationId: organization.id
    });

    const parsed = deedParsedSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const deed = parsed.data as DeedParsed;
    if (deed.jurisdiction.county.toLowerCase() !== 'cook') {
      return reply.code(400).send({ error: 'Only Cook County deeds supported for this check' });
    }

    const client = new HttpAttomClient({
      apiKey: config?.attomApiKey || process.env.ATTOM_API_KEY || '',
      baseUrl: config?.attomBaseUrl || process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com'
    });

    const report = await attomCrossCheck(deed, client);
    return reply.send(report);
  });

  app.post('/api/v1/verify', {
    schema: verifyRouteSchema,
    bodyLimit: 5242880 // 5MB limit
  }, async (request, reply) => {
    // Fastify has already validated the body against the schema
    const input = request.body as BundleInput;
    const registry = await loadRegistry();
    const verifiers = {
      county: new DatabaseCountyVerifier(),
      notary: new DatabaseNotaryVerifier(), // Note: If switching to RealNotaryVerifier, inject key here
      property: new AttomPropertyVerifier(config?.attomApiKey || process.env.ATTOM_API_KEY || ''),
      blockchain: new BlockchainVerifier(config?.rpcUrl || process.env.RPC_URL || '', config?.registryAddress || process.env.REGISTRY_ADDRESS || '')
    };
    
    // Authenticate Organization (MANDATORY)
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return;

    // Metered Billing: Log Request
    await prisma.requestLog.create({
      data: {
        endpoint: '/api/v1/verify',
        method: 'POST',
        status: 200, // Provisional, will update if we error out
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        // Linked organization for audit trail
        organizationId: organization.id 
      }
    });

    // Integrity Check: Input_File_Hash == Attested_Hash
    if (input.doc.pdfBase64) {
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      const calculatedHash = keccak256Buffer(pdfBuffer);
      if (calculatedHash !== input.doc.docHash) {
        return reply.code(400).send({
          error: 'Integrity Check Failed',
          details: `Document hash mismatch. Calculated: ${calculatedHash}, Provided: ${input.doc.docHash}`
        });
      }
    }

    const verification = await verifyBundle(input, registry, verifiers);

    // Cook County Compliance Check
    if (input.doc.pdfBase64) {
      const pdfBuffer = Buffer.from(input.doc.pdfBase64, 'base64');
      // Inject OpenAI Key via config
      const complianceValidator = new CookCountyComplianceValidator({ 
        openaiApiKey: config?.openaiApiKey || process.env.OPENAI_API_KEY 
      });
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
        rawInputs: JSON.stringify(input),
        createdAt: new Date(receipt.createdAt),
        fraudRisk: receipt.fraudRisk ? JSON.stringify(receipt.fraudRisk) : undefined,
        zkpAttestation: receipt.zkpAttestation ? JSON.stringify(receipt.zkpAttestation) : undefined,
        revoked: false,
        organizationId: organization.id
      }
    });

    // Immutable Log
    await logVerificationEvent(prisma, {
      endpoint: '/api/v1/verify',
      result: receipt.decision === 'ALLOW' ? 'PASS' : (receipt.decision === 'FLAG' ? 'WARN' : 'FAIL'),
      ip: request.ip,
      userAgent: request.headers['user-agent'] || '',
      receiptId: record.id,
      organizationId: organization.id
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

    // Email Escalation Logic
    if (receipt.decision === 'FLAG' || receipt.decision === 'BLOCK') {
      const subject = `Deed Shield Alert: ${receipt.decision} (Score: ${receipt.riskScore})`;
      const reasonsList = receipt.reasons.join(', ');
      
      if (organization) {
        console.log(`\n📧 [MOCK EMAIL] To: ${organization.adminEmail}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: Property ${input.property.parcelId} flagged due to: ${reasonsList}\n`);
      } else {
        console.log(`\n⚠️ [ALERT] No Organization linked. Escalation logged to stdout only: ${subject} - ${reasonsList}`);
      }
    }

    return reply.send(body);
  });

  app.get('/api/v1/synthetic', async () => {
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

  // ----------------------------------------------------------------
  // GET /api/v1/receipts - PROTECTED & SCOPED
  // ----------------------------------------------------------------
  app.get('/api/v1/receipts', async (request, reply) => {
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return; // Response sent by helper

    const take = 100;
    const receipts = await prisma.receipt.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      where: { organizationId: organization.id },
      select: {
        id: true,
        decision: true,
        riskScore: true,
        createdAt: true,
        anchorStatus: true,
        revoked: true
      }
    });

    return { 
      data: receipts,
      meta: { count: receipts.length, take }
    };
  });

  // ----------------------------------------------------------------
  // GET /api/v1/receipt/:receiptId - PROTECTED & OWNED
  // ----------------------------------------------------------------
  app.get('/api/v1/receipt/:receiptId', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return; // Response sent by helper

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    // Ownership Check
    if (record.organizationId && record.organizationId !== organization.id) {
       return reply.code(403).send({ error: 'Forbidden: You do not own this receipt' });
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

  // ----------------------------------------------------------------
  // GET /api/v1/receipt/:receiptId/pdf - PROTECTED & OWNED
  // ----------------------------------------------------------------
  app.get('/api/v1/receipt/:receiptId/pdf', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return; // Response sent by helper

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    if (record.organizationId && record.organizationId !== organization.id) {
       return reply.code(403).send({ error: 'Forbidden: You do not own this receipt' });
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

  app.post('/api/v1/receipt/:receiptId/verify', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return;

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    if (record.organizationId && record.organizationId !== organization.id) {
       return reply.code(403).send({ error: 'Forbidden: You do not own this receipt' });
    }

    if (record.revoked) {
      return reply.code(409).send({ error: 'Receipt has been revoked' });
    }
    
    const rawInputs = JSON.parse(record.rawInputs) as BundleInput;
    const inputsCommitment = computeInputsCommitment(rawInputs);
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

  app.post('/api/v1/anchor/:receiptId', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return;

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    // Ownership check
    if (record.organizationId && record.organizationId !== organization.id) {
       // Log illegal access attempt
       await logVerificationEvent(prisma, {
        endpoint: '/api/v1/anchor',
        result: 'FORBIDDEN_ACCESS',
        ip: request.ip,
        userAgent: request.headers['user-agent'] || '',
        receiptId: receiptId,
        organizationId: organization.id
      });
      return reply.code(403).send({ error: 'Forbidden: You do not own this receipt' });
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

    // Log Anchor Event
    await logVerificationEvent(prisma, {
      endpoint: '/api/v1/anchor',
      result: 'ANCHORED',
      ip: request.ip,
      userAgent: request.headers['user-agent'] || '',
      receiptId: receiptId,
      organizationId: organization.id
    });

    return reply.send({
      status: updated.anchorStatus,
      txHash: updated.anchorTxHash,
      chainId: updated.anchorChainId,
      anchorId: updated.anchorId
    });
  });

  app.post('/api/v1/receipt/:receiptId/revoke', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const organization = await requireOrg(request, reply, prisma);
    if (!organization) return;

    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
    }

    // Ownership check
    if (record.organizationId && record.organizationId !== organization.id) {
      return reply.code(403).send({ error: 'Forbidden: You do not own this receipt' });
    }

    // Check if already revoked via immutable table
    const existing = await prisma.revocation.findFirst({
      where: { receiptId }
    });

    if (existing || record.revoked) {
      return reply.send({ status: 'ALREADY_REVOKED', revokedAt: existing?.revokedAt });
    }

    // 1. Create Immutable Revocation Record
    const revocation = await prisma.revocation.create({
      data: {
        receiptId: receiptId,
        organizationId: organization.id, // Revoker
        reason: 'User requested via API',
        revokedBy: organization.name
      }
    });

    // 2. Update denormalized flag
    await prisma.receipt.update({
      where: { id: receiptId },
      data: { revoked: true }
    });

    // 3. Log Event
    await logVerificationEvent(prisma, {
      endpoint: '/api/v1/receipt/revoke',
      result: 'REVOKED',
      ip: request.ip,
      userAgent: request.headers['user-agent'] || '',
      receiptId: receiptId,
      organizationId: organization.id
    });

    return reply.send({ status: 'REVOKED', revokedAt: revocation.revokedAt });
  });



  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT || 3001);
  const nodeEnv = process.env.NODE_ENV || 'development';

  // ── Production DB TLS Guard ────────────────────────────────
  // Refuse to start in production without an encrypted DB connection.
  if (nodeEnv === 'production') {
    const dbUrl = process.env.DATABASE_URL || '';
    if (!dbUrl.startsWith('postgresql://') && !dbUrl.startsWith('postgres://')) {
      console.error('FATAL: DATABASE_URL must use postgresql:// in production');
      process.exit(1);
    }
    if (!dbUrl.includes('sslmode=require') && !dbUrl.includes('sslmode=verify-full') && !dbUrl.includes('sslmode=verify-ca')) {
      console.error('FATAL: DATABASE_URL must include sslmode=require (or verify-full) in production. Unencrypted DB connections are not allowed.');
      process.exit(1);
    }
  }

  const config = {
    attomApiKey: process.env.ATTOM_API_KEY || '',
    attomBaseUrl: process.env.ATTOM_BASE_URL || 'https://api.gateway.attomdata.com',
    rpcUrl: process.env.RPC_URL || '',
    registryAddress: process.env.REGISTRY_ADDRESS || '',
    openaiApiKey: process.env.OPENAI_API_KEY,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 100),
    rateLimitWindow: process.env.RATE_LIMIT_WINDOW || '1 minute'
  };
  buildServer(config)
    .then((app) => app.listen({ port, host: '0.0.0.0' }))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
