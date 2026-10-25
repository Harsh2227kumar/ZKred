// Shared helpers for the integration suites (real Postgres + a local chain with the registries deployed).
import { randomBytes } from "node:crypto";
import { config } from "../../src/config";

/** True when the DB and the chain for integration tests are configured (see test/setup-env.ts). */
export const integrationEnabled = Boolean(
  process.env.TEST_DATABASE_URL &&
    process.env.TEST_CHAIN_RPC_URL &&
    process.env.TEST_ACCREDITOR_PRIVATE_KEY &&
    process.env.TEST_ISSUER_REGISTRY_ADDRESS &&
    process.env.TEST_ANCHOR_REGISTRY_ADDRESS &&
    process.env.TEST_STATUS_REGISTRY_ADDRESS,
);

export const adminAuth = { Authorization: `Bearer ${config.ISSUER_ADMIN_TOKEN}` };

/** A unique lowercase suffix so suites never collide on unique columns (did, display_name) across runs. */
export const uniqueSuffix = (prefix: string): string => `${prefix}-${randomBytes(6).toString("hex")}`;
