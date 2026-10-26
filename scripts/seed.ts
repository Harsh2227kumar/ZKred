// scripts/seed.ts
// Seed pipeline v2 (V1.2-S4). Recreates the demo state from seed/*.json through the real API only (FLOWS §5), and is
// idempotent: issuers by did, verifiers by name, wallets by display_name, credentials by (issuer, type, wallet).
//
//   pnpm --filter scripts seed            "legacy" phase: issuers, verifiers, wallets and every legacy credential,
//                                         issued and anchored now.
//   pnpm --filter scripts seed:in-window  "in_window" phase: the credentials meant to fall inside the breach window,
//                                         issued and anchored now. Run it right before the breach demo and at least
//                                         BREACH_WINDOW_SECONDS after the legacy run (chain time decides, FLOWS §4).
//
// Wallets created by a run are claimed and backed up in the browser wallet's own backup format (encrypted with
// SEED_WALLET_PASSPHRASE), and their wallet id + token are printed once so the demo laptop can "Restore" them.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { BACKUP_KDF_ITERATIONS, verifyCredential, walletCrypto, type SignedCredential } from "@zkred/zk-core";
import { config, type SeedPhase } from "./config";

const SEED_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../seed");
/** Version of the browser wallet's backup payload (frontend/src/lib/wallet-store.ts FullWalletBackupState). */
const WALLET_BACKUP_VERSION = 1;

// ---------------------------------------------------------------- seed files

interface SeedIssuer {
  name: string;
  kind: "university" | "medical_council" | "government";
  did_suffix: string;
}
interface SeedHolder {
  display_name: string;
  full_name: string;
}
interface SeedCredential {
  phase?: SeedPhase;
  issuer_did_suffix: string;
  credential_type: "Degree" | "MedicalLicense" | "GovernmentId";
  recipient_display_name: string;
  claims: Record<string, string | number>;
}
interface SeedVerifier {
  name: string;
}

function loadJson<T>(filename: string): T {
  const file = path.join(SEED_DIR, filename);
  if (!fs.existsSync(file)) throw new Error(`[seed] Missing seed file: ${file}`);
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

// ---------------------------------------------------------------- API (CONTRACTS §3)

interface ApiIssuer {
  id: string;
  did: string;
  name: string;
  keys: { key_id: string; public_key: string; status: string }[];
}
interface ApiBatch {
  batch_id: string;
  size: number;
  status: "open" | "anchored";
  anchored_at: string | null;
}
interface ApiOffer {
  id: string;
  issuer_id: string;
  credential_type: string;
  ephemeral_public_key: string;
  iv: string;
  ciphertext: string;
  claimed_at: string | null;
}
interface ApiIssued {
  credential_type: string;
  wallet_id: string;
}

class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    what: string,
  ) {
    super(`${what} → HTTP ${status}: ${JSON.stringify(body)}`);
  }
}

async function api<T>(method: string, endpoint: string, opts: { body?: unknown; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${config.apiBaseUrl}${endpoint}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  const json = (await res.json().catch(() => null)) as unknown;
  if (!res.ok) throw new ApiError(res.status, json, `${method} ${endpoint}`);
  return json as T;
}
const admin = { token: config.adminToken };

/** Every page of a cursor-paginated list (CONTRACTS §1 lists). */
async function listAll<T>(endpoint: string, token: string): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | null = null;
  do {
    const page: { items: T[]; next_cursor: string | null } = await api("GET", `${endpoint}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { token });
    items.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor);
  return items;
}

// ---------------------------------------------------------------- phases

async function checkHealth(): Promise<{ networkName: string; breachWindowSeconds: number }> {
  const health = await api<{ status: string; db: string; chain: string; ai: string }>("GET", "/health");
  if (health.db !== "ok" || health.chain !== "ok") {
    throw new Error(`[seed] Backend not ready (db=${health.db}, chain=${health.chain}). Seeding needs both.`);
  }
  const chain = await api<{ network_name: string; breach_window_seconds: number }>("GET", "/meta/chain");
  console.log(`  ✓ db ok, chain ok (${chain.network_name}), ai ${health.ai}`);
  return { networkName: chain.network_name, breachWindowSeconds: chain.breach_window_seconds };
}

async function ensureIssuers(seed: SeedIssuer[], networkName: string): Promise<Map<string, ApiIssuer>> {
  const existing = (await api<{ items: ApiIssuer[] }>("GET", "/issuers")).items;
  const bySuffix = new Map<string, ApiIssuer>();
  for (const s of seed) {
    const found = existing.find((i) => i.did === `did:zkred:${s.did_suffix}`);
    if (found) {
      console.log(`  ✓ ${s.name} (${found.did})`);
      bySuffix.set(s.did_suffix, found);
      continue;
    }
    console.log(`  + Registering ${s.name} on ${networkName}…`);
    bySuffix.set(s.did_suffix, await api<ApiIssuer>("POST", "/issuers", { body: s, ...admin }));
  }
  return bySuffix;
}

async function ensureVerifiers(seed: SeedVerifier[]): Promise<void> {
  const existing = (await api<{ items: { name: string }[] }>("GET", "/verifiers")).items;
  for (const v of seed) {
    if (existing.some((e) => e.name === v.name)) {
      console.log(`  ✓ ${v.name}`);
      continue;
    }
    console.log(`  + Registering ${v.name}…`);
    await api("POST", "/verifiers", { body: v });
  }
}

type PrivateKeyJwk = Awaited<ReturnType<typeof walletCrypto.generateWalletKeyPair>>["privateKeyJwk"];

/** A wallet created by this run: only then do we hold its token and private key (the server never has them). */
interface CreatedWallet {
  token: string;
  publicKeyB64: string;
  privateKeyJwk: PrivateKeyJwk;
}
interface SeedWallet {
  id: string;
  displayName: string;
  created: CreatedWallet | null;
}

async function ensureWallets(seed: SeedHolder[]): Promise<Map<string, SeedWallet>> {
  const wallets = new Map<string, SeedWallet>();
  for (const h of seed) {
    try {
      const found = await api<{ id: string }>("GET", `/wallets/lookup?display_name=${encodeURIComponent(h.display_name)}`);
      console.log(`  ✓ ${h.display_name} (${h.full_name})`);
      wallets.set(h.display_name, { id: found.id, displayName: h.display_name, created: null });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 404)) throw err;
      console.log(`  + Creating wallet ${h.display_name} (${h.full_name}): P-256 key pair generated locally…`);
      const keys = await walletCrypto.generateWalletKeyPair();
      const out = await api<{ id: string; wallet_token: string }>("POST", "/wallets", {
        body: { display_name: h.display_name, enc_public_key: keys.publicKeyB64 },
      });
      wallets.set(h.display_name, {
        id: out.id,
        displayName: h.display_name,
        created: { token: out.wallet_token, publicKeyB64: keys.publicKeyB64, privateKeyJwk: keys.privateKeyJwk },
      });
    }
  }
  return wallets;
}

async function issueCredentials(
  seed: SeedCredential[],
  issuers: Map<string, ApiIssuer>,
  wallets: Map<string, SeedWallet>,
): Promise<{ issuerIds: Set<string>; holders: Set<string> }> {
  const touched = { issuerIds: new Set<string>(), holders: new Set<string>() };
  const issuedBy = new Map<string, Set<string>>();
  for (const c of seed) {
    const issuer = issuers.get(c.issuer_did_suffix);
    const wallet = wallets.get(c.recipient_display_name);
    if (!issuer) throw new Error(`[seed] credentials.json: unknown issuer did_suffix "${c.issuer_did_suffix}"`);
    if (!wallet) throw new Error(`[seed] credentials.json: unknown holder "${c.recipient_display_name}"`);
    if (!issuedBy.has(issuer.id)) {
      const records = await listAll<ApiIssued>(`/issuers/${issuer.id}/credentials`, config.adminToken);
      issuedBy.set(issuer.id, new Set(records.map((r) => `${r.credential_type}|${r.wallet_id}`)));
    }
    const key = `${c.credential_type}|${wallet.id}`;
    if (issuedBy.get(issuer.id)!.has(key)) {
      console.log(`  ✓ ${c.credential_type} from ${issuer.name} → ${c.recipient_display_name}`);
      continue;
    }
    console.log(`  + Signing ${c.credential_type} from ${issuer.name} → ${c.recipient_display_name}…`);
    await api("POST", `/issuers/${issuer.id}/credentials`, {
      body: { credential_type: c.credential_type, wallet_id: wallet.id, claims: c.claims },
      ...admin,
    });
    issuedBy.get(issuer.id)!.add(key);
    touched.issuerIds.add(issuer.id);
    touched.holders.add(c.recipient_display_name);
  }
  return touched;
}

/** Anchors every non-empty open batch of these issuers; the block time becomes their trusted issuance time. */
async function anchorOpenBatches(issuerIds: Iterable<string>, issuers: Map<string, ApiIssuer>): Promise<string[]> {
  const anchoredAt: string[] = [];
  for (const id of issuerIds) {
    const name = [...issuers.values()].find((i) => i.id === id)?.name ?? id;
    const { items } = await api<{ items: ApiBatch[] }>("GET", `/issuers/${id}/batches`);
    for (const b of items.filter((x) => x.status === "open" && x.size > 0)) {
      const out = await api<ApiBatch & { tx_hash: string }>("POST", `/issuers/${id}/batches/${b.batch_id}/anchor`, admin);
      console.log(`  ✓ ${name}: batch of ${b.size} anchored at ${out.anchored_at} (tx ${out.tx_hash})`);
      if (out.anchored_at) anchoredAt.push(out.anchored_at);
    }
  }
  return anchoredAt;
}

/**
 * For a wallet created by this run: decrypt every unclaimed offer, keep it only if its BBS signature verifies under
 * the issuer's published key, claim it, and write the encrypted backup the browser wallet restores from.
 */
async function claimAndBackUp(wallet: SeedWallet & { created: CreatedWallet }): Promise<number> {
  const auth = { token: wallet.created.token };
  const offers = (await api<{ items: ApiOffer[] }>("GET", `/wallets/${wallet.id}/offers`, auth)).items;
  const issuers = (await api<{ items: ApiIssuer[] }>("GET", "/issuers")).items;
  const credentials: SignedCredential[] = [];
  for (const offer of offers.filter((o) => !o.claimed_at)) {
    const cred = await walletCrypto.decryptOffer(wallet.created.privateKeyJwk, offer);
    const publicKey = issuers.find((i) => i.id === offer.issuer_id)?.keys.find((k) => k.key_id === cred.key_id)?.public_key;
    if (!publicKey || !(await verifyCredential(cred, new Uint8Array(Buffer.from(publicKey, "base64url"))))) {
      throw new Error(`[seed] Offer ${offer.id} for ${wallet.displayName} does not verify under its issuer's published key`);
    }
    await api("POST", `/wallets/${wallet.id}/offers/${offer.id}/claim`, auth);
    credentials.push(cred);
  }
  const state = {
    version: WALLET_BACKUP_VERSION,
    metadata: { id: wallet.id, display_name: wallet.displayName, wallet_token: wallet.created.token },
    keypair: { privateKeyJwk: wallet.created.privateKeyJwk, publicKeyB64: wallet.created.publicKeyB64 },
    credentials,
    replaced_commitments: [],
    exported_at: new Date().toISOString(),
  };
  const sealed = await walletCrypto.encryptBackup(config.walletPassphrase, state, BACKUP_KDF_ITERATIONS);
  await api("PUT", `/wallets/${wallet.id}/backup`, { body: { ...sealed, version: WALLET_BACKUP_VERSION }, ...auth });
  return credentials.length;
}

// ---------------------------------------------------------------- main

async function main() {
  const phase = config.phase;
  console.log(`ZKred seed v2 — phase "${phase}" → ${config.apiBaseUrl}\n`);

  console.log("[1/6] Backend health");
  const { networkName, breachWindowSeconds } = await checkHealth();

  console.log("\n[2/6] Issuers");
  const issuers = await ensureIssuers(loadJson<SeedIssuer[]>("issuers.json"), networkName);

  console.log("\n[3/6] Verifiers");
  await ensureVerifiers(loadJson<SeedVerifier[]>("verifiers.json"));

  console.log("\n[4/6] Holder wallets");
  const wallets = await ensureWallets(loadJson<SeedHolder[]>("holders.json"));

  console.log(`\n[5/6] ${phase} credentials`);
  const entries = loadJson<SeedCredential[]>("credentials.json").filter((c) => (c.phase ?? "legacy") === phase);
  const touched = await issueCredentials(entries, issuers, wallets);
  const anchoredAt = await anchorOpenBatches(touched.issuerIds, issuers);
  if (touched.issuerIds.size === 0) console.log("  ✓ nothing new to issue or anchor");

  console.log("\n[6/6] Claim + encrypted backup (wallets created in this run)");
  const created = [...wallets.values()].filter((w): w is SeedWallet & { created: CreatedWallet } => w.created !== null);
  for (const w of created) console.log(`  ✓ ${w.displayName}: ${await claimAndBackUp(w)} credential(s) claimed, backup stored`);
  for (const w of wallets.values()) {
    if (!w.created && touched.holders.has(w.displayName)) {
      console.log(`  · ${w.displayName} existed before this run: claim its new offer(s) in the browser wallet inbox`);
    }
  }
  if (!created.length && !touched.holders.size) console.log("  ✓ nothing to claim");

  console.log("\nDone.");
  if (created.length) {
    console.log("\nRestore these wallets in the browser (Holder Wallet → Restore), passphrase = SEED_WALLET_PASSPHRASE.");
    console.log("Each token is shown only now; keep it private:");
    for (const w of created) console.log(`  ${w.displayName.padEnd(8)} wallet id ${w.id}  token ${w.created.token}`);
  }
  if (phase === "legacy" && anchoredAt.length) {
    console.log(
      `\nLegacy batches anchored (chain time ${anchoredAt.sort()[anchoredAt.length - 1]}). For the breach demo, run ` +
        `\`pnpm --filter scripts seed:in-window\` at least ${breachWindowSeconds} s (BREACH_WINDOW_SECONDS) later.`,
    );
  }
  if (phase === "in_window" && anchoredAt.length) {
    console.log(`\nIn-window batches anchored. Report the compromise within ${breachWindowSeconds} s so they fall inside the window.`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
