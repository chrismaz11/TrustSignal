import { describe, expect, it } from 'vitest';

import { createSyntheticRegistry, generateSyntheticBundles } from './synthetic.js';
import { verifyBundle } from './verification.js';
import { MockCountyVerifier } from './mocks.js';

describe('verifyBundle', () => {
  it('flags quitclaim and out-of-state', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const bundles = await generateSyntheticBundles(registry, notaryWallets, 1, 0);
    const bundle = { ...bundles[0] };
    bundle.transactionType = 'quitclaim';
    bundle.ron.commissionState = 'NY';
    bundle.policy.profile = 'STANDARD_CA';

    const result = await verifyBundle(bundle, registry);

    expect(result.reasons).toContain('QUITCLAIM_STRICT');
    expect(result.reasons).toContain('OUT_OF_STATE_NOTARY');
    expect(result.decision).not.toBe('ALLOW');
  });

  it('blocks invalid seal', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const bundles = await generateSyntheticBundles(registry, notaryWallets, 1, 0);
    const bundle = { ...bundles[0], ron: { ...bundles[0].ron, sealPayload: 'v1:0xdeadbeef' } };

    const result = await verifyBundle(bundle, registry);

    expect(result.decision).toBe('BLOCK');
    expect(result.reasons).toContain('SEAL_INVALID');
  });

  it('checks county status with verifier', async () => {
    const { registry, notaryWallets } = createSyntheticRegistry(1);
    const bundles = await generateSyntheticBundles(registry, notaryWallets, 1, 0);
    const bundle = { ...bundles[0] };
    bundle.property = {
      parcelId: 'SCAM-101',
      county: 'Demo County',
      state: 'CA'
    };

    const verifier = new MockCountyVerifier();
    const result = await verifyBundle(bundle, registry, verifier);

    expect(result.reasons).toContain('PROPERTY_FLAGGED');
    expect(result.checks.find(c => c.checkId === 'county-status')?.status).toBe('WARN');
  });
});
