import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

const sepoliaUrl = process.env.SEPOLIA_RPC_URL;

export default defineConfig({
  plugins: [hardhatEthers, hardhatMocha],
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 }
    }
  },
  test: {
    mocha: {
      timeout: 20_000
    }
  },
  networks: {
    localhost: {
      type: 'http',
      url: 'http://127.0.0.1:8545'
    },
    ...(sepoliaUrl
      ? {
          sepolia: {
            type: 'http',
            url: sepoliaUrl,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
          }
        }
      : {})
  }
});
