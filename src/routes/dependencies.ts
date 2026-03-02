import { PrismaClient } from '@prisma/client';

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

const prisma = new PrismaClient();

export function createRouteDependencies(overrides: Partial<RouteDependencies> = {}): RouteDependencies {
  return {
    verifyBundle: verifyBundlePipeline,
    recordStore: new PrismaVerificationRecordStore(prisma),
    anchorNullifier: anchorNullifierToPolygonMumbai,
    ...overrides
  };
}
