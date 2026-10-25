// The ONLY place in contracts/ that reads configuration. Secrets come from env via configVariable
// (lazy: only resolved when that network is used), never literals.
import hardhatToolboxMochaEthers from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxMochaEthers],
  solidity: {
    version: "0.8.28",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  paths: {
    sources: "./src",
    tests: { mocha: "./test" },
  },
  networks: {
    // In-process simulated chain used by `hardhat test`.
    hardhatMainnet: { type: "edr-simulated", chainType: "l1" },
    // `pnpm --filter contracts node` → a long-running local chain (CHAIN_ID 31337) for the backend.
    localhost: { type: "http", chainType: "l1", url: "http://127.0.0.1:8545" },
    baseSepolia: {
      type: "http",
      chainType: "op",
      chainId: 84532,
      url: configVariable("BASE_SEPOLIA_RPC_URL"),
      accounts: [configVariable("DEPLOYER_PRIVATE_KEY")],
    },
  },
  verify: {
    etherscan: { apiKey: configVariable("BASESCAN_API_KEY") },
  },
});
