// issuance_batches, status_lists, issued_credentials, credential_offers. No claims are ever stored here.
import { and, asc, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../client";
import { credentialOffers, issuanceBatches, issuedCredentials, statusLists } from "../schema";

export type BatchRow = typeof issuanceBatches.$inferSelect;
export type StatusListRow = typeof statusLists.$inferSelect;
export type IssuedCredentialRow = typeof issuedCredentials.$inferSelect;
type NewCredentialRow = typeof issuedCredentials.$inferInsert;
type NewOfferRow = typeof credentialOffers.$inferInsert;

// ---------------------------------------------------------------- batches

/** The newest open batch of `issuerId` signed by `keyId` that still has room, or null. */
export async function findOpenBatch(issuerId: string, keyId: string, maxSize: number): Promise<BatchRow | null> {
  const [row] = await db
    .select()
    .from(issuanceBatches)
    .where(
      and(
        eq(issuanceBatches.issuerId, issuerId),
        eq(issuanceBatches.keyId, keyId),
        eq(issuanceBatches.status, "open"),
        sql`cardinality(${issuanceBatches.leaves}) < ${maxSize}`,
      ),
    )
    .orderBy(desc(issuanceBatches.createdAt))
    .limit(1);
  return row ?? null;
}

export async function insertBatch(row: { batchId: string; issuerId: string; keyId: string }): Promise<BatchRow> {
  const [created] = await db.insert(issuanceBatches).values(row).returning();
  if (!created) throw new Error("batch insert returned no row");
  return created;
}

export async function findBatch(batchId: string): Promise<BatchRow | null> {
  const [row] = await db.select().from(issuanceBatches).where(eq(issuanceBatches.batchId, batchId));
  return row ?? null;
}

export async function listBatches(issuerId: string): Promise<BatchRow[]> {
  return db
    .select()
    .from(issuanceBatches)
    .where(eq(issuanceBatches.issuerId, issuerId))
    .orderBy(desc(issuanceBatches.createdAt));
}

/** open → anchored. Returns null if the batch was not open any more. */
export async function markBatchAnchored(
  batchId: string,
  anchor: { root: string; anchoredAt: Date; txHash: string | null },
): Promise<BatchRow | null> {
  const [row] = await db
    .update(issuanceBatches)
    .set({ status: "anchored", root: anchor.root, anchoredAt: anchor.anchoredAt, txHash: anchor.txHash })
    .where(and(eq(issuanceBatches.batchId, batchId), eq(issuanceBatches.status, "open")))
    .returning();
  return row ?? null;
}

// ---------------------------------------------------------------- status lists

/** The issuer's fullest status list that still has a free slot (lists fill one at a time), or null. */
export async function findStatusListWithRoom(issuerId: string): Promise<StatusListRow | null> {
  const [row] = await db
    .select()
    .from(statusLists)
    .where(and(eq(statusLists.issuerId, issuerId), lt(statusLists.nextIndex, statusLists.size)))
    .orderBy(desc(statusLists.nextIndex))
    .limit(1);
  return row ?? null;
}

export async function insertStatusList(row: typeof statusLists.$inferInsert): Promise<StatusListRow> {
  const [created] = await db.insert(statusLists).values(row).returning();
  if (!created) throw new Error("status list insert returned no row");
  return created;
}

export async function findStatusList(listId: string): Promise<StatusListRow | null> {
  const [row] = await db.select().from(statusLists).where(eq(statusLists.listId, listId));
  return row ?? null;
}

// ---------------------------------------------------------------- issuance

/**
 * Atomically: appends the commitment to its (still open) batch, claims the status slot the credential was signed
 * with (only if it is still the next free one), and stores the credential record + the encrypted offer.
 * Any race (batch anchored meanwhile, slot already taken) aborts the whole transaction.
 */
export async function recordIssuance(credential: NewCredentialRow, offer: Omit<NewOfferRow, "id">): Promise<{ credentialId: string; offerId: string }> {
  return db.transaction(async (tx) => {
    const [batch] = await tx
      .update(issuanceBatches)
      .set({ leaves: sql`array_append(${issuanceBatches.leaves}, ${credential.commitment})` })
      .where(and(eq(issuanceBatches.batchId, credential.batchId), eq(issuanceBatches.status, "open")))
      .returning({ id: issuanceBatches.id });
    if (!batch) throw new Error(`batch ${credential.batchId} is no longer open`);

    const [slot] = await tx
      .update(statusLists)
      .set({ nextIndex: sql`${statusLists.nextIndex} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(statusLists.listId, credential.statusListId),
          eq(statusLists.nextIndex, credential.statusIndex),
          lt(statusLists.nextIndex, statusLists.size),
        ),
      )
      .returning({ id: statusLists.id });
    if (!slot) throw new Error(`status slot ${credential.statusListId}#${credential.statusIndex} is no longer free`);

    const [created] = await tx.insert(issuedCredentials).values(credential).returning({ id: issuedCredentials.id });
    const [createdOffer] = await tx.insert(credentialOffers).values(offer).returning({ id: credentialOffers.id });
    if (!created || !createdOffer) throw new Error("issuance insert returned no row");
    return { credentialId: created.id, offerId: createdOffer.id };
  });
}

/** Keyset page, newest first. `after` = the last row of the previous page. */
export async function listIssuedCredentials(
  issuerId: string,
  limit: number,
  after?: { issuedAt: Date; id: string },
): Promise<IssuedCredentialRow[]> {
  const page = after
    ? or(
        lt(issuedCredentials.issuedAt, after.issuedAt),
        and(eq(issuedCredentials.issuedAt, after.issuedAt), lt(issuedCredentials.id, after.id)),
      )
    : undefined;
  return db
    .select()
    .from(issuedCredentials)
    .where(and(eq(issuedCredentials.issuerId, issuerId), page))
    .orderBy(desc(issuedCredentials.issuedAt), desc(issuedCredentials.id))
    .limit(limit);
}

export async function findIssuedCredential(id: string): Promise<IssuedCredentialRow | null> {
  const [row] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.id, id));
  return row ?? null;
}

export async function findIssuedByCommitment(commitment: string): Promise<IssuedCredentialRow | null> {
  const [row] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.commitment, commitment));
  return row ?? null;
}

/** True if some credential was re-issued from `credentialId`. */
export async function hasReissue(credentialId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: issuedCredentials.id })
    .from(issuedCredentials)
    .where(eq(issuedCredentials.reissuedFrom, credentialId));
  return Boolean(row);
}

/** Stores the new status bits (whose hash is now on-chain) and marks the credential revoked, atomically. */
export async function recordRevocation(r: {
  credentialId: string;
  listId: string;
  bitstring: Buffer;
  hash: string;
  txHash: string;
  at: Date;
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(statusLists)
      .set({ bitstring: r.bitstring, onchainHash: r.hash, txHash: r.txHash, updatedAt: r.at })
      .where(eq(statusLists.listId, r.listId));
    const [revoked] = await tx
      .update(issuedCredentials)
      .set({ revokedAt: r.at })
      .where(and(eq(issuedCredentials.id, r.credentialId), isNull(issuedCredentials.revokedAt)))
      .returning({ id: issuedCredentials.id });
    if (!revoked) throw new Error(`credential ${r.credentialId} was revoked concurrently`);
  });
}

/** Every batch signed by `keyId`, oldest first. */
export async function listBatchesByKey(keyId: string): Promise<BatchRow[]> {
  return db.select().from(issuanceBatches).where(eq(issuanceBatches.keyId, keyId)).orderBy(asc(issuanceBatches.createdAt));
}

/** Appends commitments to a batch that is still open (attack console: a breached pipeline injecting leaves). */
export async function appendLeaves(batchId: string, commitments: string[]): Promise<boolean> {
  const [row] = await db
    .update(issuanceBatches)
    .set({ leaves: sql`${issuanceBatches.leaves} || ARRAY[${sql.join(commitments.map((c) => sql`${c}`), sql`, `)}]::text[]` })
    .where(and(eq(issuanceBatches.batchId, batchId), eq(issuanceBatches.status, "open")))
    .returning({ id: issuanceBatches.id });
  return Boolean(row);
}
