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

export interface VerificationRecord {
  id: string;
  bundleHash: string;
  nonMemOk: boolean;
  revocationOk: boolean;
  zkmlOk: boolean;
  fraudScore: number;
  proofGenMs: number;
  timestamp: string;
  revoked: boolean;
  revocationReason: string | null;
  revocationTxHash: string | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationRecordStore {
  create(input: CreateVerificationRecordInput): Promise<VerificationRecord>;
  findByBundleHash(bundleHash: string): Promise<VerificationRecord | null>;
  revokeByBundleHash(
    bundleHash: string,
    input: RevokeVerificationRecordInput
  ): Promise<VerificationRecord | null>;
}

type VerificationRecordDelegate = {
  create(args: {
    data: CreateVerificationRecordInput;
  }): Promise<VerificationRecord>;
  findUnique(args: {
    where: { bundleHash: string };
  }): Promise<VerificationRecord | null>;
  update(args: {
    where: { bundleHash: string };
    data: {
      revoked: boolean;
      revocationReason: string;
      revocationTxHash: string;
      revokedAt: Date;
    };
  }): Promise<VerificationRecord>;
};

type PrismaVerificationRecordStoreClient = {
  verificationRecord: VerificationRecordDelegate;
};

export class PrismaVerificationRecordStore implements VerificationRecordStore {
  constructor(private readonly prisma: PrismaVerificationRecordStoreClient) {}

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
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }
}
