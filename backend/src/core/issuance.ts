// Issuance, batches and status lists (CONTRACTS §3.2, §4.2). Every credential gets a random commitment (its Merkle
// leaf), a slot in the issuer's open batch and its own status-list bit. Claims are signed, encrypted to the holder's
// wallet key and then dropped: the DB keeps only the non-PII record.
import { randomBytes } from "node:crypto";
import {
  CREDENTIAL_LAYOUTS,
  merkleRoot,
  signCredential,
  statusList,
  verifyCredential,
  walletCrypto,
  type CredentialType,
  type Hex32,
  type SignedCredential,
} from "@zkred/zk-core";
import { config } from "../config";
import * as repo from "../db/repositories/issuance.repo";
import * as issuersRepo from "../db/repositories/issuers.repo";
import * as walletsRepo from "../db/repositories/wallets.repo";
import * as chain from "../integrations/chain";
import type {
  Batch,
  BatchLeaves,
  IssueCredentialIn,
  IssueCredentialOut,
  IssuedCredential,
  ReissueIn,
  RevokeOut,
  StatusListOut,
} from "../schemas/issuance.schema";
import { deriveFields, validateClaims } from "./claims";
import { AppError } from "./errors";
import { openBbsSecretKey, openGovernanceKey, withIssuerLock } from "./issuers";

const randomHex32 = (): Hex32 => `0x${randomBytes(32).toString("hex")}`;

async function requireIssuer(issuerId: string): Promise<issuersRepo.IssuerRow> {
  const issuer = await issuersRepo.findIssuerWithSecrets(issuerId);
  if (!issuer) throw new AppError("NOT_FOUND", "Issuer not found");
  return issuer;
}

function toBatch(b: repo.BatchRow): Batch {
  return {
    batch_id: b.batchId as Hex32,
    issuer_id: b.issuerId,
    key_id: b.keyId as Hex32,
    size: b.leaves.length,
    status: b.status,
    root: (b.root as Hex32 | null) ?? null,
    anchored_at: b.anchoredAt?.toISOString() ?? null,
    tx_hash: b.txHash,
  };
}

/** A new, empty status list whose hash is pinned on-chain before any credential points at it. */
export async function createStatusList(issuer: issuersRepo.IssuerRow): Promise<repo.StatusListRow> {
  const listId = randomHex32();
  const bits = statusList.create(config.STATUS_LIST_SIZE);
  const hash = statusList.hash(bits);
  const tx = await chain.setListHash(
    openGovernanceKey(issuer.did, issuer.governanceKeyEnc),
    issuer.issuerChainId as Hex32,
    listId,
    hash,
  );
  return repo.insertStatusList({
    listId,
    issuerId: issuer.id,
    size: config.STATUS_LIST_SIZE,
    bitstring: Buffer.from(bits),
    onchainHash: hash,
    txHash: tx.txHash,
  });
}

/**
 * Signs `claims` (+ derived fields) with the issuer's active key into its open batch and a fresh status slot,
 * encrypts the credential to the holder's wallet key and records it (no claims stored). Caller holds the issuer lock.
 */
async function signAndOffer(
  issuerId: string,
  type: CredentialType,
  claims: Record<string, string>,
  walletId: string,
  reissuedFrom: string | null,
): Promise<IssueCredentialOut> {
  const walletKey = await walletsRepo.findWalletEncryptionKey(walletId);
  if (!walletKey) throw new AppError("VALIDATION_ERROR", "Unknown wallet", { wallet_id: "no wallet with this id" });
  const issuer = await requireIssuer(issuerId);
  const key = await issuersRepo.findActiveKeyWithSecret(issuerId);
  if (!key) throw new AppError("CONFLICT", "Issuer has no active signing key");

  const batch =
    (await repo.findOpenBatch(issuerId, key.keyId, config.BATCH_MAX_SIZE)) ??
    (await repo.insertBatch({ batchId: randomHex32(), issuerId, keyId: key.keyId }));
  const list = (await repo.findStatusListWithRoom(issuerId)) ?? (await createStatusList(issuer));

  const commitment = randomHex32();
  const issuedAt = new Date();
  const values: Record<string, string> = {
    cred_type: type,
    issuer_did: issuer.did,
    key_id: key.keyId,
    batch_id: batch.batchId,
    status_list_id: list.listId,
    status_index: String(list.nextIndex),
    commitment,
    issued_at: issuedAt.toISOString(),
    holder_binding: "",
    ...claims,
    ...(await deriveFields(type, claims)),
  };
  const credential = await signCredential({
    secretKey: openBbsSecretKey(key.keyId, key.secretKeyEnc),
    publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
    type,
    values,
  });
  const offer = await walletCrypto.encryptOffer(walletKey, credential);

  const { credentialId, offerId } = await repo.recordIssuance(
    {
      issuerId,
      walletId,
      credentialType: type,
      batchId: batch.batchId,
      keyId: key.keyId,
      statusListId: list.listId,
      statusIndex: list.nextIndex,
      commitment,
      issuedAt,
      reissuedFrom,
    },
    {
      walletId,
      issuerId,
      credentialType: type,
      ephemeralPublicKey: offer.ephemeral_public_key,
      iv: offer.iv,
      ciphertext: offer.ciphertext,
    },
  );
  return {
    credential_id: credentialId,
    offer_id: offerId,
    batch_id: batch.batchId as Hex32,
    status_list_id: list.listId as Hex32,
    status_index: list.nextIndex,
    commitment,
  };
}

export async function issueCredential(issuerId: string, input: IssueCredentialIn): Promise<IssueCredentialOut> {
  const claims = validateClaims(input.credential_type, input.claims);
  return withIssuerLock(issuerId, () => signAndOffer(issuerId, input.credential_type, claims, input.wallet_id, null));
}

/**
 * Flips the credential's status bit and pins the new list hash on-chain. If an earlier attempt got the tx mined but
 * crashed before the DB update, the chain already holds the new hash and only the DB is brought in line.
 */
export async function revokeCredential(issuerId: string, credentialId: string): Promise<RevokeOut> {
  return withIssuerLock(issuerId, async () => {
    const issuer = await requireIssuer(issuerId);
    const cred = await repo.findIssuedCredential(credentialId);
    if (!cred || cred.issuerId !== issuerId) throw new AppError("NOT_FOUND", "Credential not found");
    if (cred.revokedAt) throw new AppError("CONFLICT", "Credential is already revoked");
    const list = await repo.findStatusList(cred.statusListId);
    if (!list) throw new Error(`status list ${cred.statusListId} missing for credential ${credentialId}`);

    const bits = new Uint8Array(list.bitstring);
    statusList.setBit(bits, cred.statusIndex, true);
    const hash = statusList.hash(bits);
    const onchain = await chain.getListHash(list.listId as Hex32);
    let txHash = list.txHash ?? "";
    if (onchain?.listHash.toLowerCase() !== hash.toLowerCase()) {
      const tx = await chain.setListHash(
        openGovernanceKey(issuer.did, issuer.governanceKeyEnc),
        issuer.issuerChainId as Hex32,
        list.listId as Hex32,
        hash,
      );
      txHash = tx.txHash;
    }
    await repo.recordRevocation({ credentialId, listId: list.listId, bitstring: Buffer.from(bits), hash, txHash, at: new Date() });
    return {
      credential_id: credentialId,
      status_list_id: list.listId as Hex32,
      status_index: cred.statusIndex,
      list_hash: hash,
      tx_hash: txHash,
    };
  });
}

/**
 * True when no verifier will accept this credential any more through no fault of the holder: its batch was anchored
 * at or after its key's compromise cutoff, or it was never anchored and its key can no longer anchor.
 */
function needsReissue(batch: repo.BatchRow, key: { status: string; compromisedFrom: Date | null }): boolean {
  if (!batch.anchoredAt) return key.status !== "active";
  return key.status === "compromised" && key.compromisedFrom !== null && batch.anchoredAt.getTime() >= key.compromisedFrom.getTime();
}

/**
 * Re-issues a holder's credential under the issuer's current key (breach recovery). The old credential must carry a
 * valid signature by one of this issuer's keys AND its commitment must be in the issuer's own records for this
 * wallet, unrevoked and not yet re-issued: forgeries made with a stolen key are not in those records, so they can't
 * be laundered into fresh credentials.
 */
export async function reissue(issuerId: string, input: ReissueIn): Promise<{ offer_id: string }> {
  const old = input.old_credential as SignedCredential;
  const refused = (why: string) => new AppError("FORBIDDEN", "This credential cannot be re-issued", { old_credential: why });
  return withIssuerLock(issuerId, async () => {
    const issuer = await requireIssuer(issuerId);
    if (old.issuer_did !== issuer.did) throw refused("issued by another issuer");
    const key = await issuersRepo.findKey(old.key_id);
    if (!key || key.issuerId !== issuerId) throw refused("signed by an unknown key");
    if (!(await verifyCredential(old, new Uint8Array(Buffer.from(key.publicKey, "base64url"))))) throw refused("invalid signature");

    const record = await repo.findIssuedByCommitment(old.values.commitment ?? "");
    if (!record || record.issuerId !== issuerId || record.keyId !== old.key_id) throw refused("not in the issuer's records");
    if (record.walletId !== input.wallet_id) throw refused("issued to another wallet");
    if (record.revokedAt) throw refused("revoked");
    if (await repo.hasReissue(record.id)) throw new AppError("CONFLICT", "This credential was already re-issued");
    const batch = await repo.findBatch(record.batchId);
    if (!batch || !needsReissue(batch, key)) {
      throw new AppError("CONFLICT", "This credential is still valid; there is nothing to refresh", {
        old_credential: batch?.anchoredAt ? "anchored before any compromise cutoff" : "waiting for its batch to be anchored",
      });
    }

    const claims: Record<string, string> = {};
    for (const f of CREDENTIAL_LAYOUTS[old.type].fields) {
      if (f.source === "claim") claims[f.name] = old.values[f.name] ?? "";
    }
    const out = await signAndOffer(issuerId, old.type, validateClaims(old.type, claims), input.wallet_id, record.id);
    return { offer_id: out.offer_id };
  });
}

// Cursor = base64url("<issued_at ISO>|<id>") of the last item on the previous page.
const encodeCursor = (c: repo.IssuedCredentialRow) =>
  Buffer.from(`${c.issuedAt.toISOString()}|${c.id}`, "utf8").toString("base64url");

function decodeCursor(cursor: string): { issuedAt: Date; id: string } {
  const [ts, id, ...rest] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
  const issuedAt = new Date(ts ?? "");
  if (rest.length || !id || !/^[0-9a-f-]{36}$/i.test(id) || Number.isNaN(issuedAt.getTime())) {
    throw new AppError("VALIDATION_ERROR", "Invalid cursor", { cursor: "not a cursor from this list" });
  }
  return { issuedAt, id };
}

export async function listIssuedCredentials(
  issuerId: string,
  page: { limit: number; cursor?: string },
): Promise<{ items: IssuedCredential[]; next_cursor: string | null }> {
  const after = page.cursor ? decodeCursor(page.cursor) : undefined;
  await requireIssuer(issuerId);
  const rows = await repo.listIssuedCredentials(issuerId, page.limit + 1, after);
  const items = rows.slice(0, page.limit);
  return {
    items: items.map((c) => ({
      id: c.id,
      credential_type: c.credentialType,
      wallet_id: c.walletId,
      batch_id: c.batchId as Hex32,
      status_index: c.statusIndex,
      commitment: c.commitment as Hex32,
      key_id: c.keyId as Hex32,
      issued_at: c.issuedAt.toISOString(),
      revoked_at: c.revokedAt?.toISOString() ?? null,
    })),
    next_cursor: rows.length > page.limit ? encodeCursor(items[items.length - 1]!) : null,
  };
}

export async function listBatches(issuerId: string): Promise<{ items: Batch[] }> {
  await requireIssuer(issuerId);
  return { items: (await repo.listBatches(issuerId)).map(toBatch) };
}

/**
 * Anchors root = merkleRoot(leaves) on-chain; the block time becomes the batch's trusted issuance time.
 * If an earlier attempt anchored on-chain but crashed before the DB update, the DB is re-synced from the chain.
 */
export async function anchorBatch(issuerId: string, batchId: Hex32): Promise<Batch> {
  return withIssuerLock(issuerId, async () => {
    const issuer = await requireIssuer(issuerId);
    const batch = await repo.findBatch(batchId);
    if (!batch || batch.issuerId !== issuerId) throw new AppError("NOT_FOUND", "Batch not found");
    return toBatch(await anchorLocked(issuer, batch));
  });
}

/** anchorBatch for a caller that already holds the issuer lock. */
async function anchorLocked(issuer: issuersRepo.IssuerRow, batch: repo.BatchRow): Promise<repo.BatchRow> {
  if (batch.status === "anchored") throw new AppError("CONFLICT", "Batch is already anchored");
  if (batch.leaves.length === 0) throw new AppError("CONFLICT", "Batch is empty");
  const batchId = batch.batchId as Hex32;
  const root = merkleRoot(batch.leaves as Hex32[]);

  const existing = await chain.getAnchor(batchId);
  if (existing) {
    if (existing.root.toLowerCase() !== root.toLowerCase() || existing.issuerChainId !== issuer.issuerChainId) {
      throw new AppError("CONFLICT", "A different root is already anchored for this batch id");
    }
    return markAnchored(batchId, { root, anchoredAt: existing.anchoredAt, txHash: null });
  }

  const active = await issuersRepo.findActiveKeyWithSecret(issuer.id);
  if (active?.keyId !== batch.keyId) {
    // AnchorRegistry only accepts the active key: a batch signed by a retired key can never be anchored.
    throw new AppError("CONFLICT", "The key that signed this batch is no longer active");
  }
  const tx = await chain.anchor(
    openGovernanceKey(issuer.did, issuer.governanceKeyEnc),
    batchId,
    issuer.issuerChainId as Hex32,
    batch.keyId as Hex32,
    root,
  );
  return markAnchored(batchId, { root, anchoredAt: tx.blockTime, txHash: tx.txHash });
}

/**
 * Anchors every non-empty open batch of `keyId` while it is still the active key. Called before a planned rotation:
 * once the key is retired the chain refuses its anchors, and those holders' credentials could never verify.
 * The caller holds the issuer lock. Never used on compromise: an open batch may then contain forgeries.
 */
export async function anchorOpenBatchesOfKey(issuer: issuersRepo.IssuerRow, keyId: string): Promise<repo.BatchRow[]> {
  const open = (await repo.listBatchesByKey(keyId)).filter((b) => b.status === "open" && b.leaves.length > 0);
  const anchored: repo.BatchRow[] = [];
  for (const b of open) anchored.push(await anchorLocked(issuer, b));
  return anchored;
}

async function markAnchored(batchId: string, anchor: { root: string; anchoredAt: Date; txHash: string | null }) {
  const row = await repo.markBatchAnchored(batchId, anchor);
  if (!row) throw new AppError("CONFLICT", "Batch is already anchored");
  return row;
}

export async function getBatchLeaves(batchId: Hex32): Promise<BatchLeaves> {
  const batch = await repo.findBatch(batchId);
  if (!batch) throw new AppError("NOT_FOUND", "Batch not found");
  return { batch_id: batch.batchId as Hex32, root: (batch.root as Hex32 | null) ?? null, leaves: batch.leaves as Hex32[] };
}

/** The full list (herd privacy) plus both hashes; `onchain_hash` is read from StatusRegistry, never from the DB. */
export async function getStatusList(listId: Hex32): Promise<StatusListOut> {
  const list = await repo.findStatusList(listId);
  if (!list) throw new AppError("NOT_FOUND", "Status list not found");
  const onchain = await chain.getListHash(listId);
  if (!onchain) throw new AppError("NOT_FOUND", "Status list is not registered on-chain");
  const bits = new Uint8Array(list.bitstring);
  return {
    list_id: list.listId as Hex32,
    issuer_id: list.issuerId,
    size: list.size,
    encoded: statusList.encode(bits),
    hash: statusList.hash(bits),
    onchain_hash: onchain.listHash,
  };
}
