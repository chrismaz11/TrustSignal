import { verifyBundle as verifyBundlePipeline } from '../core/verifyBundle.js';
import { anchorNullifierToPolygonMumbai, type PolygonAnchorResult } from '../services/polygonMumbaiAnchor.js';
import {
  PrismaVerificationRecordStore,
  type VerificationRecordStore
} from '../storage/verificationRecordStore.js';
import type { CombinedResult, VerifyBundleInput } from '../types/VerificationResult.js';

export interface RouteDependencies {
  verifyBundle: (input: VerifyBundleInput) => Promise<CombinedResult>;
  recordStore: VerificationRecordStore;
  anchorNullifier: (bundleHash: string) => Promise<PolygonAnchorResult>;
}

export async function createRouteDependencies(
  overrides: Partial<RouteDependencies> = {}
): Promise<RouteDependencies> {
  let recordStore = overrides.recordStore;
  if (!recordStore) {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    recordStore = new PrismaVerificationRecordStore(prisma);
  }

  return {
    verifyBundle: verifyBundlePipeline,
    recordStore,
    anchorNullifier: anchorNullifierToPolygonMumbai,
    ...overrides
  };
}
