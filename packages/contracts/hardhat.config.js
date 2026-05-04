import { defineConfig } from 'hardhat/config';
import hardhatEthers from '@nomicfoundation/hardhat-ethers';
import hardhatMocha from '@nomicfoundation/hardhat-mocha';

const IteratorPrototype = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));
if (!IteratorPrototype.flatMap) {
  IteratorPrototype.flatMap = function*(mapper) {
    for (const item of this) {
      yield* mapper(item);
    }
  };
}
if (!IteratorPrototype.toArray) {
  IteratorPrototype.toArray = function() {
    const result = [];
    for (const item of this) {
      result.push(item);
    }
    return result;
  };
}

const sepoliaUrl = process.env.SEPOLIA_RPC_URL;
const polygonAmoyUrl = process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology';

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
      : {}),
    polygonAmoy: {
      type: 'http',
      url: polygonAmoyUrl,
      chainId: 80002,
      accounts: process.env.POLYGON_AMOY_PRIVATE_KEY ? [process.env.POLYGON_AMOY_PRIVATE_KEY] : []
    }
  }
});
