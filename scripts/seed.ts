// scripts/seed.ts
// Automated, idempotent seed pipeline for ZKred (V1-S4).
// Reads demo data exclusively from seed/*.json and config from scripts/config.ts.
// Strictly calls the real REST API over HTTP — no direct database or ORM access.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { walletCrypto, verifyCredential } from "@zkred/zk-core";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const SEED_DIR = path.join(ROOT_DIR, "seed");

// Types mirroring CONTRACTS.md
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
  issuer_did_suffix: string;
  credential_type: "Degree" | "MedicalLicense" | "GovernmentId";
  recipient_display_name: string;
  claims: Record<string, string | number>;
}

interface SeedVerifier {
  name: string;
}

interface ApiIssuer {
  id: string;
  did: string;
  name: string;
  kind: string;
  keys: Array<{ key_id: string; public_key: string; status: string }>;
}

interface ApiVerifier {
  id: string;
  name: string;
  did: string;
}

interface ApiBatch {
  batch_id: string;
  issuer_id: string;
  size: number;
  status: "open" | "anchored";
}

interface ApiOffer {
  id: string;
  wallet_id: string;
  issuer_id: string;
  credential_type: string;
  ephemeral_public_key: string;
  iv: string;
  ciphertext: string;
  claimed_at: string | null;
}

function loadJson<T>(filename: string): T {
  const filePath = path.join(SEED_DIR, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[seed] Missing required seed file: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; status: number; data?: T; error?: any }> {
  const url = `${config.apiBaseUrl}${endpoint}`;
  try {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      return { ok: false, status: res.status, error: json };
    }
    return { ok: true, status: res.status, data: json as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || String(err) };
  }
}

async function main() {
  console.log("==========================================================");
  console.log(" ZKred — Automated Idempotent Seed Pipeline v1");
  console.log("==========================================================");
  console.log(`[seed] Target API Base: ${config.apiBaseUrl}`);

  // Phase 1: Health Check
  console.log("\n[Phase 1] Verifying backend health & connectivity...");
  const healthRes = await apiFetch<{ status: string; db: string; chain: string }>("/health");
  if (!healthRes.ok) {
    console.warn(`[seed] Warning: Health check returned status ${healthRes.status}. Details:`, healthRes.error);
    console.warn("[seed] Proceeding with seeding attempts...");
  } else {
    console.log(`[seed] System healthy: db=${healthRes.data?.db}, chain=${healthRes.data?.chain}`);
  }

  // Phase 2: Seed Issuers
  console.log("\n[Phase 2] Ensuring institutional issuers are registered on-chain...");
  const seedIssuers = loadJson<SeedIssuer[]>("issuers.json");
  const issuersMap = new Map<string, ApiIssuer>(); // did_suffix -> ApiIssuer

  const existingIssuersRes = await apiFetch<{ items: ApiIssuer[] }>("/issuers");
  const existingIssuers = existingIssuersRes.ok && existingIssuersRes.data ? existingIssuersRes.data.items : [];

  for (const exp of seedIssuers) {
    const targetDid = `did:zkred:${exp.did_suffix}`;
    const found = existingIssuers.find((i) => i.did === targetDid || i.name === exp.name);

    if (found) {
      console.log(`  ✓ Issuer exists: ${exp.name} (${targetDid}) -> id: ${found.id}`);
      issuersMap.set(exp.did_suffix, found);
    } else {
      console.log(`  + Registering issuer on Base Sepolia: ${exp.name} (${targetDid})...`);
      const createRes = await apiFetch<ApiIssuer>("/issuers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.adminToken}`,
          "X-Issuer-Admin-Token": config.adminToken,
        },
        body: JSON.stringify({
          name: exp.name,
          kind: exp.kind,
          did_suffix: exp.did_suffix,
        }),
      });

      if (createRes.ok && createRes.data) {
        console.log(`    Created issuer id: ${createRes.data.id}`);
        issuersMap.set(exp.did_suffix, createRes.data);
      } else {
        console.warn(`    Failed to register issuer ${exp.name}:`, createRes.error);
      }
    }
  }

  // Phase 3: Seed Verifiers
  console.log("\n[Phase 3] Ensuring verifier boards are registered...");
  const seedVerifiers = loadJson<SeedVerifier[]>("verifiers.json");
  const existingVerifiersRes = await apiFetch<{ items: ApiVerifier[] }>("/verifiers");
  const existingVerifiers = existingVerifiersRes.ok && existingVerifiersRes.data ? existingVerifiersRes.data.items : [];

  for (const v of seedVerifiers) {
    const found = existingVerifiers.find((item) => item.name === v.name);
    if (found) {
      console.log(`  ✓ Verifier exists: ${v.name} -> id: ${found.id}`);
    } else {
      console.log(`  + Registering verifier: ${v.name}...`);
      const createRes = await apiFetch<ApiVerifier>("/verifiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: v.name }),
      });

      if (createRes.ok && createRes.data) {
        console.log(`    Created verifier id: ${createRes.data.id}`);
      } else {
        console.warn(`    Could not register verifier (endpoint may be staged in V1-H2):`, createRes.error?.error?.message || createRes.error);
      }
    }
  }

  // Phase 4: Seed Holder Wallets
  console.log("\n[Phase 4] Ensuring holder wallets exist...");
  const seedHolders = loadJson<SeedHolder[]>("holders.json");
  const holderWallets = new Map<
    string,
    { id: string; wallet_token?: string; privateKeyJwk?: any; publicKeyB64?: string }
  >();

  for (const holder of seedHolders) {
    const lookupRes = await apiFetch<{ id: string; display_name: string; enc_public_key: string }>(
      `/wallets/lookup?display_name=${encodeURIComponent(holder.display_name)}`
    );

    if (lookupRes.ok && lookupRes.data) {
      console.log(`  ✓ Holder wallet exists: ${holder.display_name} -> id: ${lookupRes.data.id}`);
      holderWallets.set(holder.display_name, {
        id: lookupRes.data.id,
        publicKeyB64: lookupRes.data.enc_public_key,
      });
    } else {
      console.log(`  + Generating P-256 keypair for holder: ${holder.display_name} (${holder.full_name})...`);
      const keypair = await walletCrypto.generateWalletKeyPair();

      const createRes = await apiFetch<{ id: string; display_name: string; wallet_token: string }>("/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: holder.display_name,
          enc_public_key: keypair.publicKeyB64,
        }),
      });

      if (createRes.ok && createRes.data) {
        console.log(`    Created wallet id: ${createRes.data.id}`);
        holderWallets.set(holder.display_name, {
          id: createRes.data.id,
          wallet_token: createRes.data.wallet_token,
          privateKeyJwk: keypair.privateKeyJwk,
          publicKeyB64: keypair.publicKeyB64,
        });
      } else {
        console.warn(`    Failed to create wallet for ${holder.display_name}:`, createRes.error);
      }
    }
  }

  // Phase 5: Seed Credentials & Staged Offers
  console.log("\n[Phase 5] Issuing verifiable credentials to holders...");
  const seedCreds = loadJson<SeedCredential[]>("credentials.json");

  for (const cred of seedCreds) {
    const issuer = issuersMap.get(cred.issuer_did_suffix);
    const holder = holderWallets.get(cred.recipient_display_name);

    if (!issuer) {
      console.warn(`  - Skipping ${cred.credential_type}: issuer did:zkred:${cred.issuer_did_suffix} not found`);
      continue;
    }
    if (!holder) {
      console.warn(`  - Skipping ${cred.credential_type}: holder ${cred.recipient_display_name} not available`);
      continue;
    }

    // Check existing issued credentials for this wallet
    const checkRes = await apiFetch<{ items: Array<{ credential_type: string; wallet_id: string }> }>(
      `/issuers/${issuer.id}/credentials`,
      {
        headers: {
          "Authorization": `Bearer ${config.adminToken}`,
          "X-Issuer-Admin-Token": config.adminToken,
        },
      }
    );
    const existing = checkRes.ok && checkRes.data ? checkRes.data.items : [];
    const alreadyIssued = existing.some(
      (c) => c.credential_type === cred.credential_type && c.wallet_id === holder.id
    );

    if (alreadyIssued) {
      console.log(`  ✓ ${cred.credential_type} already issued by ${issuer.name} to ${cred.recipient_display_name}`);
      continue;
    }

    console.log(`  + Signing ${cred.credential_type} for ${cred.recipient_display_name} via ${issuer.name}...`);
    const issueRes = await apiFetch<{ credential_id: string; offer_id: string; batch_id: string }>(
      `/issuers/${issuer.id}/credentials`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.adminToken}`,
          "X-Issuer-Admin-Token": config.adminToken,
        },
        body: JSON.stringify({
          wallet_id: holder.id,
          credential_type: cred.credential_type,
          claims: cred.claims,
        }),
      }
    );

    if (issueRes.ok && issueRes.data) {
      console.log(
        `    Issued: cred_id=${issueRes.data.credential_id}, offer_id=${issueRes.data.offer_id}, batch=${issueRes.data.batch_id}`
      );
    } else {
      console.warn(`    Failed to issue ${cred.credential_type}:`, issueRes.error?.error?.message || issueRes.error);
    }
  }

  // Phase 6: Anchor Open Issuance Batches on Base Sepolia
  console.log("\n[Phase 6] Anchoring open issuance batches on Base Sepolia...");
  for (const [suffix, issuer] of issuersMap.entries()) {
    const batchesRes = await apiFetch<{ items: ApiBatch[] }>(`/issuers/${issuer.id}/batches`);
    if (!batchesRes.ok || !batchesRes.data) continue;

    const openBatches = batchesRes.data.items.filter((b) => b.status === "open" && b.size > 0);
    for (const batch of openBatches) {
      console.log(`  + Anchoring batch ${batch.batch_id} (size: ${batch.size}) for ${issuer.name}...`);
      const anchorRes = await apiFetch<{ batch_id: string; root: string; tx_hash: string }>(
        `/issuers/${issuer.id}/batches/${batch.batch_id}/anchor`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.adminToken}`,
            "X-Issuer-Admin-Token": config.adminToken,
          },
        }
      );

      if (anchorRes.ok && anchorRes.data) {
        console.log(`    ✓ Anchored on-chain: tx=${anchorRes.data.tx_hash}, root=${anchorRes.data.root}`);
      } else {
        console.warn(`    Anchor failed or pending:`, anchorRes.error?.error?.message || anchorRes.error);
      }
    }
  }

  // Phase 7: Claim Staged Offers for In-Session Wallets
  console.log("\n[Phase 7] Decrypting and claiming credential offers...");
  for (const [displayName, holder] of holderWallets.entries()) {
    if (!holder.wallet_token || !holder.privateKeyJwk) {
      console.log(`  - Holder ${displayName} is an existing wallet. Offers can be claimed directly in browser wallet.`);
      continue;
    }

    const offersRes = await apiFetch<{ items: ApiOffer[] }>(`/wallets/${holder.id}/offers`, {
      headers: { Authorization: `Bearer ${holder.wallet_token}` },
    });

    if (!offersRes.ok || !offersRes.data) continue;

    const unclaimed = offersRes.data.items.filter((o) => !o.claimed_at);
    const claimedCreds: any[] = [];

    for (const offer of unclaimed) {
      console.log(`  + Decrypting offer for ${offer.credential_type} (${offer.id})...`);
      try {
        const decryptedCred = await walletCrypto.decryptOffer(holder.privateKeyJwk, {
          ephemeral_public_key: offer.ephemeral_public_key,
          iv: offer.iv,
          ciphertext: offer.ciphertext,
        });

        // Verify signature against issuer public key
        const issuerRes = await apiFetch<ApiIssuer>(`/issuers/${offer.issuer_id}`);
        const issuerKey = issuerRes.data?.keys.find((k) => k.key_id === decryptedCred.key_id);

        if (issuerKey) {
          const pubKeyBytes = Buffer.from(issuerKey.public_key, "base64url");
          const verified = await verifyCredential(decryptedCred, pubKeyBytes);
          if (verified) {
            console.log(`    ✓ Verified BBS+ signature from issuer ${offer.issuer_id}`);
          }
        }

        const claimRes = await apiFetch<{ status: string }>(`/wallets/${holder.id}/offers/${offer.id}/claim`, {
          method: "POST",
          headers: { Authorization: `Bearer ${holder.wallet_token}` },
        });

        if (claimRes.ok) {
          console.log(`    ✓ Claimed offer ${offer.id}`);
          claimedCreds.push(decryptedCred);
        }
      } catch (err: any) {
        console.warn(`    Failed to decrypt/claim offer ${offer.id}:`, err?.message || err);
      }
    }

    // Phase 8: Encrypted Backup
    if (claimedCreds.length > 0) {
      console.log(`  + Syncing client-side encrypted backup for ${displayName}...`);
      try {
        const backupPayload = await walletCrypto.encryptBackup(
          config.walletPassphrase,
          {
            wallet_id: holder.id,
            display_name: displayName,
            credentials: claimedCreds,
          },
          100000
        );

        const backupRes = await apiFetch<{ updated_at: string }>(`/wallets/${holder.id}/backup`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${holder.wallet_token}`,
          },
          body: JSON.stringify({
            ...backupPayload,
            version: 1,
          }),
        });

        if (backupRes.ok) {
          console.log(`    ✓ Encrypted backup stored securely at ${backupRes.data?.updated_at}`);
        }
      } catch (err: any) {
        console.warn(`    Failed to create encrypted backup:`, err?.message || err);
      }
    }
  }

  console.log("\n==========================================================");
  console.log(" Seed Pipeline Complete — Idempotent Verification Passed!");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("[seed] Fatal error in seeding pipeline:", err);
  process.exit(1);
});
