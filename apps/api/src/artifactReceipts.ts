import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';
import { CompactSign, compactVerify, decodeProtectedHeader, importJWK } from 'jose';
import type { SecurityConfig } from './security.js';

export type ArtifactVerificationRequest = {
  artifact: {
    hash: string;
    algorithm: 'sha256';
  };
  source: {
    provider: string;
    repository?: string;
    workflow?: string;
    runId?: string;
    commit?: string;
    actor?: string;
  };
  metadata?: {
    artifactPath?: string;
  };
};

type ArtifactReceiptRow = {
  receiptId: string;
  verificationId: string;
  artifactHash: string;
  algorithm: string;
  sourceProvider: string;
  repository: string | null;
  workflow: string | null;
  runId: string | null;
  commitSha: string | null;
  actor: string | null;
  status: string;
  receiptSignature: string;
  receiptSignatureAlg: string;
  receiptSignatureKid: string;
  metadataArtifactPath: string | null;
  createdAt: Date;
};

type SignedArtifactReceiptPayload = {
  receiptVersion: '1.0';
  receiptId: string;
  verificationId: string;
  createdAt: string;
  artifact: {
    hash: string;
    algorithm: 'sha256';
  };
  source: {
    provider: string;
    repository?: string;
    workflow?: string;
    runId?: string;
    commit?: string;
    actor?: string;
  };
  metadata?: {
    artifactPath?: string;
  };
  status: string;
};

function canonicalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => canonicalizeValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((accumulator, key) => {
        const nextValue = (value as Record<string, unknown>)[key];
        if (typeof nextValue !== 'undefined') {
          accumulator[key] = canonicalizeValue(nextValue);
        }
        return accumulator;
      }, {});
  }

  return value;
}

function canonicalizeArtifactPayload(payload: SignedArtifactReceiptPayload): string {
  return JSON.stringify(canonicalizeValue(payload));
}

async function signArtifactReceiptPayload(
  payload: SignedArtifactReceiptPayload,
  securityConfig: SecurityConfig
) {
  const signer = securityConfig.receiptSigning.current;
  const key = await importJWK(signer.privateJwk, signer.alg);
  const signature = await new CompactSign(
    new TextEncoder().encode(canonicalizeArtifactPayload(payload))
  )
    .setProtectedHeader({ alg: signer.alg, kid: signer.kid, typ: 'receipt+jws' })
    .sign(key);

  return {
    signature,
    alg: signer.alg,
    kid: signer.kid
  };
}

async function verifyArtifactReceiptSignature(
  payload: SignedArtifactReceiptPayload,
  signature: {
    signature: string;
    alg: 'EdDSA';
    kid: string;
  },
  securityConfig: SecurityConfig
) {
  try {
    const header = decodeProtectedHeader(signature.signature);
    const kid = typeof header.kid === 'string' ? header.kid : signature.kid;
    const alg = typeof header.alg === 'string' ? header.alg : signature.alg;
    const publicJwk = securityConfig.receiptSigning.verificationKeys.get(kid);
    if (!publicJwk) {
      return false;
    }

    const key = await importJWK(publicJwk, alg);
    const { payload: verifiedPayload, protectedHeader } = await compactVerify(signature.signature, key);
    const payloadString = new TextDecoder().decode(verifiedPayload);
    return (
      payloadString === canonicalizeArtifactPayload(payload) &&
      protectedHeader.alg === signature.alg &&
      protectedHeader.kid === signature.kid
    );
  } catch {
    return false;
  }
}

function toSignedPayload(row: ArtifactReceiptRow): SignedArtifactReceiptPayload {
  return {
    receiptVersion: '1.0',
    receiptId: row.receiptId,
    verificationId: row.verificationId,
    createdAt: row.createdAt.toISOString(),
    artifact: {
      hash: row.artifactHash,
      algorithm: 'sha256'
    },
    source: {
      provider: row.sourceProvider,
      ...(row.repository ? { repository: row.repository } : {}),
      ...(row.workflow ? { workflow: row.workflow } : {}),
      ...(row.runId ? { runId: row.runId } : {}),
      ...(row.commitSha ? { commit: row.commitSha } : {}),
      ...(row.actor ? { actor: row.actor } : {})
    },
    metadata: row.metadataArtifactPath
      ? { artifactPath: row.metadataArtifactPath }
      : undefined,
    status: row.status
  };
}

export async function issueArtifactReceipt(
  prisma: PrismaClient,
  securityConfig: SecurityConfig,
  input: ArtifactVerificationRequest
) {
  const receiptId = randomUUID();
  const verificationId = receiptId;
  const createdAt = new Date();
  const status = 'verified';
  const unsignedPayload: SignedArtifactReceiptPayload = {
    receiptVersion: '1.0',
    receiptId,
    verificationId,
    createdAt: createdAt.toISOString(),
    artifact: input.artifact,
    source: input.source,
    ...(input.metadata?.artifactPath ? { metadata: { artifactPath: input.metadata.artifactPath } } : {}),
    status
  };

  const receiptSignature = await signArtifactReceiptPayload(unsignedPayload, securityConfig);

  await prisma.$executeRawUnsafe(
    `INSERT INTO "ArtifactReceipt" (
      "receiptId",
      "verificationId",
      "artifactHash",
      "algorithm",
      "sourceProvider",
      "repository",
      "workflow",
      "runId",
      "commitSha",
      "actor",
      "status",
      "receiptSignature",
      "receiptSignatureAlg",
      "receiptSignatureKid",
      "metadataArtifactPath",
      "createdAt"
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    receiptId,
    verificationId,
    input.artifact.hash,
    input.artifact.algorithm,
    input.source.provider,
    input.source.repository || null,
    input.source.workflow || null,
    input.source.runId || null,
    input.source.commit || null,
    input.source.actor || null,
    status,
    receiptSignature.signature,
    receiptSignature.alg,
    receiptSignature.kid,
    input.metadata?.artifactPath || null,
    createdAt
  );

  return {
    verificationId,
    receiptId,
    receiptSignature: receiptSignature.signature,
    status
  };
}

export async function getArtifactReceiptById(
  prisma: PrismaClient,
  receiptId: string
): Promise<ArtifactReceiptRow | null> {
  const rows = await prisma.$queryRawUnsafe<ArtifactReceiptRow[]>(
    `SELECT
      "receiptId",
      "verificationId",
      "artifactHash",
      "algorithm",
      "sourceProvider",
      "repository",
      "workflow",
      "runId",
      "commitSha",
      "actor",
      "status",
      "receiptSignature",
      "receiptSignatureAlg",
      "receiptSignatureKid",
      "metadataArtifactPath",
      "createdAt"
     FROM "ArtifactReceipt"
     WHERE "receiptId" = $1
     LIMIT 1`,
    receiptId
  );

  return rows[0] || null;
}

export async function verifyArtifactReceiptById(
  prisma: PrismaClient,
  securityConfig: SecurityConfig,
  receiptId: string,
  artifact: { hash: string; algorithm: 'sha256' }
) {
  const row = await getArtifactReceiptById(prisma, receiptId);
  if (!row) return null;

  const unsignedPayload = toSignedPayload(row);
  const signatureVerified = await verifyArtifactReceiptSignature(
    unsignedPayload,
    {
      signature: row.receiptSignature,
      alg: row.receiptSignatureAlg as 'EdDSA',
      kid: row.receiptSignatureKid
    },
    securityConfig
  );

  const integrityVerified =
    row.algorithm === artifact.algorithm &&
    row.artifactHash === artifact.hash;
  const verified = integrityVerified && signatureVerified;

  return {
    verified,
    integrityVerified,
    signatureVerified,
    status: verified ? row.status : 'mismatch',
    receiptId: row.receiptId,
    receiptSignature: row.receiptSignature,
    storedHash: row.artifactHash,
    recomputedHash: artifact.hash
  };
}
