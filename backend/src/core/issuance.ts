// Issuance, batches and status lists (CONTRACTS §3.2, §4.2). Every credential gets a random commitment (its Merkle
// leaf), a slot in the issuer's open batch and its own status-list bit. Claims are signed, encrypted to the holder's
// wallet key and then dropped: the DB keeps only the non-PII record.
import { randomBytes } from "node:crypto";
import { merkleRoot, signCredential, statusList, walletCrypto, type CredentialType, type Hex32 } from "@zkred/zk-core";
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
async function createStatusList(issuer: issuersRepo.IssuerRow): Promise<repo.StatusListRow> {
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

export async function issueCredential(issuerId: string, input: IssueCredentialIn): Promise<IssueCredentialOut> {
  const type: CredentialType = input.credential_type;
  const claims = validateClaims(type, input.claims);
  const walletKey = await walletsRepo.findWalletEncryptionKey(input.wallet_id);
  if (!walletKey) throw new AppError("VALIDATION_ERROR", "Unknown wallet", { wallet_id: "no wallet with this id" });

  return withIssuerLock(issuerId, async () => {
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
        walletId: input.wallet_id,
        credentialType: type,
        batchId: batch.batchId,
        keyId: key.keyId,
        statusListId: list.listId,
        statusIndex: list.nextIndex,
        commitment,
        issuedAt,
      },
      {
        walletId: input.wallet_id,
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
    if (batch.status === "anchored") throw new AppError("CONFLICT", "Batch is already anchored");
    if (batch.leaves.length === 0) throw new AppError("CONFLICT", "Batch is empty");
    const root = merkleRoot(batch.leaves as Hex32[]);

    const existing = await chain.getAnchor(batchId);
    if (existing) {
      if (existing.root.toLowerCase() !== root.toLowerCase() || existing.issuerChainId !== issuer.issuerChainId) {
        throw new AppError("CONFLICT", "A different root is already anchored for this batch id");
      }
      return toBatch(await markAnchored(batchId, { root, anchoredAt: existing.anchoredAt, txHash: null }));
    }

    const active = await issuersRepo.findActiveKeyWithSecret(issuerId);
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
    return toBatch(await markAnchored(batchId, { root, anchoredAt: tx.blockTime, txHash: tx.txHash }));
  });
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
