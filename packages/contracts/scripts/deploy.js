import { network } from 'hardhat';

async function main() {
  const { ethers } = await network.connect();
  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      'No deploy signer available. Set PRIVATE_KEY (or POLYGON_AMOY_PRIVATE_KEY) and rerun.'
    );
  }

  const AnchorRegistry = await ethers.getContractFactory('AnchorRegistry');
  const registry = await AnchorRegistry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`AnchorRegistry deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
