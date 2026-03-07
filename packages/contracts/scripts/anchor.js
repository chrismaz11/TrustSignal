import { ethers } from 'hardhat';

async function main() {
  const receiptHash = process.env.RECEIPT_HASH;
  const subjectDigest = process.env.ANCHOR_SUBJECT_DIGEST || process.env.SUBJECT_DIGEST;
  const registryAddress = process.env.ANCHOR_REGISTRY_ADDRESS;

  if (!receiptHash || !registryAddress) {
    throw new Error('Missing RECEIPT_HASH or ANCHOR_REGISTRY_ADDRESS');
  }

  const registry = await ethers.getContractAt('AnchorRegistry', registryAddress);
  const tx = subjectDigest
    ? await registry.anchorWithSubject(receiptHash, subjectDigest)
    : await registry.anchor(receiptHash);
  const receipt = await tx.wait();
  console.log(
    subjectDigest
      ? `Anchored ${receiptHash} with subject ${subjectDigest} in tx ${receipt?.hash}`
      : `Anchored ${receiptHash} in tx ${receipt?.hash}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
