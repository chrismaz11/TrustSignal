import assert from 'node:assert/strict';
import { network } from 'hardhat';

const { ethers } = await network.connect();

async function main() {
  const registry = await ethers.deployContract('AnchorRegistry');
  await registry.waitForDeployment();

  const receiptHash = ethers.keccak256(ethers.toUtf8Bytes('receipt-smoke'));
  const subjectDigest = ethers.keccak256(ethers.toUtf8Bytes('subject-smoke'));

  await (await registry.anchorWithSubject(receiptHash, subjectDigest)).wait();

  assert.equal(await registry.isAnchored(receiptHash), true);
  assert.equal(await registry.isSubjectAnchored(subjectDigest), true);
  assert.equal(await registry.subjectForReceipt(receiptHash), subjectDigest);

  console.log('anchor-registry-smoke:ok');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
