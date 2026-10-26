// Postgres schema — mirrors md/CONTRACTS.md §5. Holder claims are NEVER stored in plaintext.
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { CREDENTIAL_TYPES, ISSUER_KINDS } from "@zkred/zk-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "bytea" });

export const issuerKind = pgEnum("issuer_kind", ISSUER_KINDS);
export const credentialType = pgEnum("credential_type", CREDENTIAL_TYPES);
export const keyStatus = pgEnum("key_status", ["active", "rotated", "compromised"]);
export const batchStatus = pgEnum("batch_status", ["open", "anchored"]);
export const verificationResult = pgEnum("verification_result", ["accepted", "rejected"]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const issuers = pgTable("issuers", {
  id: uuid("id").primaryKey().defaultRandom(),
  did: text("did").notNull().unique(),
  name: text("name").notNull(),
  kind: issuerKind("kind").notNull(),
  issuerChainId: text("issuer_chain_id").notNull().unique(),
  governanceAddress: text("governance_address").notNull(),
  governanceKeyEnc: text("governance_key_enc").notNull(),
  createdAt: createdAt(),
});

export const issuerKeys = pgTable("issuer_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  keyId: text("key_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  secretKeyEnc: text("secret_key_enc").notNull(),
  status: keyStatus("status").notNull(),
  activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
  compromisedFrom: timestamp("compromised_from", { withTimezone: true }),
  txHash: text("tx_hash").notNull(),
  createdAt: createdAt(),
}, (t) => [index("issuer_keys_issuer_id_idx").on(t.issuerId)]);

export const issuanceBatches = pgTable("issuance_batches", {
  id: uuid("id").primaryKey().defaultRandom(),
  batchId: text("batch_id").notNull().unique(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  keyId: text("key_id").notNull().references(() => issuerKeys.keyId),
  status: batchStatus("status").notNull().default("open"),
  leaves: text("leaves").array().notNull().default(sql`'{}'::text[]`),
  root: text("root"),
  anchoredAt: timestamp("anchored_at", { withTimezone: true }),
  txHash: text("tx_hash"),
  createdAt: createdAt(),
}, (t) => [index("issuance_batches_issuer_id_idx").on(t.issuerId)]);

export const wallets = pgTable("wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  displayName: text("display_name").notNull().unique(),
  encPublicKey: text("enc_public_key").notNull(),
  tokenHash: text("token_hash").notNull(),
  createdAt: createdAt(),
}, (t) => [
  // Every 👛 request looks the wallet up by its token hash.
  unique("wallets_token_hash_unique").on(t.tokenHash),
]);

export const issuedCredentials = pgTable("issued_credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  credentialType: credentialType("credential_type").notNull(),
  batchId: text("batch_id").notNull().references(() => issuanceBatches.batchId),
  keyId: text("key_id").notNull().references(() => issuerKeys.keyId),
  statusListId: text("status_list_id").notNull().references(() => statusLists.listId),
  statusIndex: integer("status_index").notNull(),
  commitment: text("commitment").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  reissuedFrom: uuid("reissued_from").references((): AnyPgColumn => issuedCredentials.id),
  // zk-core credentialDigest of the signed credential (not PII): re-issue only accepts the exact credential signed.
  credentialDigest: text("credential_digest"),
}, (t) => [
  // One revocation bit per credential: a shared bit would revoke two holders at once.
  unique("issued_credentials_status_slot_unique").on(t.statusListId, t.statusIndex),
  index("issued_credentials_issuer_id_idx").on(t.issuerId),
  index("issued_credentials_wallet_id_idx").on(t.walletId),
]);

export const statusLists = pgTable("status_lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: text("list_id").notNull().unique(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  size: integer("size").notNull(),
  bitstring: bytea("bitstring").notNull(),
  nextIndex: integer("next_index").notNull().default(0),
  onchainHash: text("onchain_hash"),
  txHash: text("tx_hash"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("status_lists_issuer_id_idx").on(t.issuerId)]);

export const credentialOffers = pgTable("credential_offers", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").notNull().references(() => wallets.id),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  credentialType: credentialType("credential_type").notNull(),
  ephemeralPublicKey: text("ephemeral_public_key").notNull(),
  iv: text("iv").notNull(),
  ciphertext: text("ciphertext").notNull(),
  createdAt: createdAt(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }),
}, (t) => [index("credential_offers_wallet_id_idx").on(t.walletId)]);

export const walletBackups = pgTable("wallet_backups", {
  walletId: uuid("wallet_id").primaryKey().references(() => wallets.id),
  ciphertext: text("ciphertext").notNull(),
  iv: text("iv").notNull(),
  salt: text("salt").notNull(),
  kdfIterations: integer("kdf_iterations").notNull(),
  version: integer("version").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const verifiers = pgTable("verifiers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  did: text("did").notNull().unique(),
  createdAt: createdAt(),
});

export const presentationRequests = pgTable("presentation_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  verifierId: uuid("verifier_id").notNull().references(() => verifiers.id),
  nlText: text("nl_text"),
  policy: jsonb("policy").notNull(),
  consentSummary: text("consent_summary").notNull(),
  nonce: text("nonce").notNull().unique(),
  nonceUsedAt: timestamp("nonce_used_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  requestId: uuid("request_id").notNull().references(() => presentationRequests.id),
  mode: text("mode").notNull(),
  result: verificationResult("result").notNull(),
  steps: jsonb("steps").notNull(),
  revealed: jsonb("revealed").notNull(),
  createdAt: createdAt(),
}, (t) => [index("verifications_request_id_idx").on(t.requestId)]);

export const attackState = pgTable("attack_state", {
  id: uuid("id").primaryKey().defaultRandom(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  keyId: text("key_id").notNull(),
  secretKeyEnc: text("secret_key_enc").notNull(),
  stolenAt: timestamp("stolen_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attackForgeries = pgTable("attack_forgeries", {
  id: uuid("id").primaryKey().defaultRandom(),
  forgedSetId: uuid("forged_set_id").notNull(),
  issuerId: uuid("issuer_id").notNull().references(() => issuers.id),
  credential: jsonb("credential").notNull(),
  createdAt: createdAt(),
});

export const attackRuns = pgTable("attack_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  mode: text("mode").notNull(),
  total: integer("total").notNull(),
  accepted: integer("accepted").notNull(),
  rejected: integer("rejected").notNull(),
  byCode: jsonb("by_code").notNull(),
  ranAt: timestamp("ran_at", { withTimezone: true }).notNull().defaultNow(),
});
