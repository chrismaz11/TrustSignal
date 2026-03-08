import { ethers } from 'hardhat';

async function main() {
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
