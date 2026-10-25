// Shared helpers for the integration suites (real Postgres + a local chain with the registries deployed).
import { randomBytes } from "node:crypto";
import { walletCrypto } from "@zkred/zk-core";
import request from "supertest";
import type { createApp } from "../../src/app";
import { config } from "../../src/config";
import { db } from "../../src/db/client";
import { wallets } from "../../src/db/schema";

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

type App = ReturnType<typeof createApp>;

/** Registers an issuer through the API (real chain txs). */
export async function createIssuer(app: App, kind = "university") {
  const res = await request(app)
    .post("/api/v1/issuers")
    .set(adminAuth)
    .send({ name: `Issuer ${uniqueSuffix("n")}`, kind, did_suffix: uniqueSuffix("iss") })
    .expect(201);
  return res.body as { id: string; did: string; keys: { key_id: string; public_key: string; status: string }[] };
}

/** A holder wallet row with a real ECDH key pair; the private key stays in the test like it stays in the browser. */
export async function createWalletRow() {
  const keys = await walletCrypto.generateWalletKeyPair();
  const [row] = await db
    .insert(wallets)
    .values({ displayName: uniqueSuffix("holder"), encPublicKey: keys.publicKeyB64, tokenHash: randomBytes(32).toString("hex") })
    .returning();
  return { id: row!.id, privateKeyJwk: keys.privateKeyJwk };
}
