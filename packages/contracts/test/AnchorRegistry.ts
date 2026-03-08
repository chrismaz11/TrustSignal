import assert from 'node:assert/strict';

import { network } from 'hardhat';

const { ethers } = await network.connect();

describe('AnchorRegistry', function () {
  it('binds a receipt hash to a provenance subject digest', async function () {
    const registry = await ethers.deployContract('AnchorRegistry');
    await registry.waitForDeployment();

    const receiptHash = ethers.keccak256(ethers.toUtf8Bytes('receipt-1'));
    const subjectDigest = ethers.keccak256(ethers.toUtf8Bytes('subject-1'));

    await (await registry.anchorWithSubject(receiptHash, subjectDigest)).wait();

    assert.equal(await registry.isAnchored(receiptHash), true);
    assert.equal(await registry.isSubjectAnchored(subjectDigest), true);
    assert.equal(await registry.subjectForReceipt(receiptHash), subjectDigest);
  });

  it('rejects re-anchoring the same receipt or subject', async function () {
    const registry = await ethers.deployContract('AnchorRegistry');
    await registry.waitForDeployment();

    const receiptHash = ethers.keccak256(ethers.toUtf8Bytes('receipt-2'));
    const subjectDigest = ethers.keccak256(ethers.toUtf8Bytes('subject-2'));

    await (await registry.anchorWithSubject(receiptHash, subjectDigest)).wait();

    await assert.rejects(
      registry.anchorWithSubject(receiptHash, ethers.keccak256(ethers.toUtf8Bytes('subject-3'))),
      /Receipt already anchored/
    );

    await assert.rejects(
      registry.anchorWithSubject(ethers.keccak256(ethers.toUtf8Bytes('receipt-3')), subjectDigest),
      /Subject already anchored/
    );
  });
});
