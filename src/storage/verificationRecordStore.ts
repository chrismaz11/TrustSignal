import { Prisma, PrismaClient, type VerificationRecord } from '@prisma/client';

export interface CreateVerificationRecordInput {
  bundleHash: string;
  nonMemOk: boolean;
  revocationOk: boolean;
  zkmlOk: boolean;
  fraudScore: number;
  proofGenMs: number;
  timestamp: string;
}

export interface RevokeVerificationRecordInput {
  reason: string;
  txHash: string;
  revokedAt: Date;
}

export interface VerificationRecordStore {
  create(input: CreateVerificationRecordInput): Promise<VerificationRecord>;
  findByBundleHash(bundleHash: string): Promise<VerificationRecord | null>;
  revokeByBundleHash(
    bundleHash: string,
    input: RevokeVerificationRecordInput
  ): Promise<VerificationRecord | null>;
}

export class PrismaVerificationRecordStore implements VerificationRecordStore {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateVerificationRecordInput): Promise<VerificationRecord> {
    return this.prisma.verificationRecord.create({
      data: {
        bundleHash: input.bundleHash,
        nonMemOk: input.nonMemOk,
        revocationOk: input.revocationOk,
        zkmlOk: input.zkmlOk,
        fraudScore: input.fraudScore,
        proofGenMs: input.proofGenMs,
        timestamp: input.timestamp
      }
    });
  }

  async findByBundleHash(bundleHash: string): Promise<VerificationRecord | null> {
    return this.prisma.verificationRecord.findUnique({
      where: { bundleHash }
    });
  }

  async revokeByBundleHash(
    bundleHash: string,
    input: RevokeVerificationRecordInput
  ): Promise<VerificationRecord | null> {
    try {
      return await this.prisma.verificationRecord.update({
        where: { bundleHash },
        data: {
          revoked: true,
          revocationReason: input.reason,
          revocationTxHash: input.txHash,
          revokedAt: input.revokedAt
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return null;
      }
      throw error;
    }
  }
}
