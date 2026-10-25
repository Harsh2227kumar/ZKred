// Test-only environment. Secrets/keys/addresses are generated per run (no literals, AGENTS.md §2).
// Dependencies point at closed local ports unless real ones are given, so health reports "down" fast.
//
// Integration suites (test/integration/**) run only when these are set; otherwise they are skipped:
//   TEST_DATABASE_URL                 Postgres (migrations are applied by test/global-setup.ts)
//   TEST_CHAIN_RPC_URL                a local chain, e.g. `pnpm --filter contracts node`
//   TEST_ACCREDITOR_PRIVATE_KEY       the deployer of the registries on that chain (a funded dev account)
//   TEST_ISSUER_REGISTRY_ADDRESS / TEST_ANCHOR_REGISTRY_ADDRESS / TEST_STATUS_REGISTRY_ADDRESS
//                                     from `pnpm --filter contracts deploy:local`
import { randomBytes } from "node:crypto";
import { Wallet } from "ethers";

const secret = () => randomBytes(32).toString("base64");
const address = () => Wallet.createRandom().address;

Object.assign(process.env, {
  NODE_ENV: "test",
  LOG_LEVEL: "error",
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://zkred:zkred@127.0.0.1:1/zkred",
  CORS_ORIGINS: "http://127.0.0.1:5173",
  PUBLIC_BASE_URL: "http://127.0.0.1:5173",
  ISSUER_ADMIN_TOKEN: randomBytes(24).toString("hex"),
  KEY_ENCRYPTION_SECRET: secret(),
  GOVERNANCE_KEY_ENCRYPTION_SECRET: secret(),
  DEMO_MODE: "true",
  CHAIN_ID: process.env.TEST_CHAIN_ID ?? "31337",
  CHAIN_NETWORK_NAME: "Hardhat (test)",
  CHAIN_RPC_URL: process.env.TEST_CHAIN_RPC_URL ?? "http://127.0.0.1:1",
  ACCREDITOR_PRIVATE_KEY: process.env.TEST_ACCREDITOR_PRIVATE_KEY ?? Wallet.createRandom().privateKey,
  ISSUER_REGISTRY_ADDRESS: process.env.TEST_ISSUER_REGISTRY_ADDRESS ?? address(),
  ANCHOR_REGISTRY_ADDRESS: process.env.TEST_ANCHOR_REGISTRY_ADDRESS ?? address(),
  STATUS_REGISTRY_ADDRESS: process.env.TEST_STATUS_REGISTRY_ADDRESS ?? address(),
  CHAIN_POLL_INTERVAL_MS: "100",
  EXPLORER_TX_URL_TEMPLATE: "http://127.0.0.1/tx/{tx}",
  BREACH_WINDOW_SECONDS: "900",
  ZK_ARTIFACTS_DIR: "../circuits/build",
  AWS_REGION: "ap-south-1",
  BEDROCK_MODEL_ID: "test-model",
  AWS_BEARER_TOKEN_BEDROCK: randomBytes(16).toString("hex"),
  AI_TIMEOUT_MS: "1500",
  HEALTH_CHECK_TIMEOUT_MS: "1500",
});
