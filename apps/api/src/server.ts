import { randomUUID } from 'crypto';

import Fastify from 'fastify';
import { keccak256, toUtf8Bytes } from 'ethers';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import {
  BundleInput,
  CheckResult,
  buildReceipt,
  canonicalizeJson,
  computeReceiptHash,
  computeInputsCommitment,
  deriveNotaryWallet,
  signDocHash,
  verifyBundle,
  MockCountyVerifier,
  MockStateNotaryVerifier,
  MockPropertyVerifier
} from '@deed-shield/core';

import { anchorReceipt } from './anchor.js';
import { ensureDatabase } from './db.js';
import { loadRegistry } from './registryLoader.js';
import { renderReceiptPdf } from './receiptPdf.js';

const prisma = new PrismaClient();

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
    docHash: z.string().min(1)
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
    receiptHash: record.receiptHash
  };
}

export async function buildServer() {
  const app = Fastify({ logger: true });
  await ensureDatabase(prisma);

  app.get('/api/v1/health', async () => ({ status: 'ok' }));

  app.post('/api/v1/verify', async (request, reply) => {
    const parsed = verifyInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid payload', details: parsed.error.flatten() });
    }

    const input = parsed.data as BundleInput;
    const registry = await loadRegistry();
    const verifiers = {
      county: new MockCountyVerifier(),
      notary: new MockStateNotaryVerifier(),
      property: new MockPropertyVerifier()
    };
    const verification = await verifyBundle(input, registry, verifiers);
    const receipt = buildReceipt(input, verification);

    const record = await prisma.receipt.create({
      data: {
        id: receipt.receiptId,
        receiptHash: receipt.receiptHash,
        inputsCommitment: receipt.inputsCommitment,
        policyProfile: receipt.policyProfile,
        decision: receipt.decision,
        reasons: JSON.stringify(receipt.reasons),
        riskScore: receipt.riskScore,
        checks: JSON.stringify(receipt.checks),
        rawInputs: JSON.stringify(input),
        createdAt: new Date(receipt.createdAt)
      }
    });

    return reply.send({
      decision: receipt.decision,
      reasons: receipt.reasons,
      riskScore: receipt.riskScore,
      receiptId: record.id,
      receiptHash: receipt.receiptHash,
      anchor: {
        status: record.anchorStatus,
        txHash: record.anchorTxHash || undefined,
        chainId: record.anchorChainId || undefined,
        anchorId: record.anchorId || undefined
      }
    });
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

  app.get('/api/v1/receipt/:receiptId', async (request, reply) => {
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
      verifierId: receipt.verifierId
    });

    return reply.send({
      receipt,
      canonicalReceipt,
      pdfUrl: `/api/v1/receipt/${receiptId}/pdf`,
      anchor: {
        status: record.anchorStatus,
        txHash: record.anchorTxHash || undefined,
        chainId: record.anchorChainId || undefined,
        anchorId: record.anchorId || undefined
      }
    });
  });

  app.get('/api/v1/receipt/:receiptId/pdf', async (request, reply) => {
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

  app.post('/api/v1/receipt/:receiptId/verify', async (request, reply) => {
    const { receiptId } = request.params as { receiptId: string };
    const record = await prisma.receipt.findUnique({ where: { id: receiptId } });
    if (!record) {
      return reply.code(404).send({ error: 'Receipt not found' });
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
      verifierId: receipt.verifierId
    });

    const ok = recomputedHash === receipt.receiptHash && inputsCommitment === record.inputsCommitment;

    return reply.send({
      verified: ok,
      recomputedHash,
      storedHash: receipt.receiptHash,
      inputsCommitment
    });
  });

  app.post('/api/v1/anchor/:receiptId', async (request, reply) => {
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

  app.get('/api/v1/receipts', async () => {
    const records: ReceiptListRecord[] = await prisma.receipt.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return records.map((record) => ({
      receiptId: record.id,
      decision: record.decision,
      riskScore: record.riskScore,
      createdAt: record.createdAt,
      anchorStatus: record.anchorStatus
    }));
  });

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const port = Number(process.env.PORT || 3001);
  buildServer()
    .then((app) => app.listen({ port, host: '0.0.0.0' }))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
