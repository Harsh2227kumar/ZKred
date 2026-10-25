// wallets, credential_offers (read/claim side) and wallet_backups. Never holds plaintext holder claims.
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { credentialOffers, walletBackups, wallets } from "../schema";

export type WalletRow = typeof wallets.$inferSelect;
export type OfferRow = typeof credentialOffers.$inferSelect;
export type BackupRow = typeof walletBackups.$inferSelect;

export async function findWalletEncryptionKey(walletId: string): Promise<string | null> {
  const [row] = await db.select({ encPublicKey: wallets.encPublicKey }).from(wallets).where(eq(wallets.id, walletId));
  return row?.encPublicKey ?? null;
}

export async function insertWallet(row: { displayName: string; encPublicKey: string; tokenHash: string }): Promise<WalletRow> {
  const [created] = await db.insert(wallets).values(row).returning();
  if (!created) throw new Error("wallet insert returned no row");
  return created;
}

export async function findWalletByDisplayName(displayName: string): Promise<WalletRow | null> {
  const [row] = await db.select().from(wallets).where(eq(wallets.displayName, displayName));
  return row ?? null;
}

export async function findWalletIdByTokenHash(tokenHash: string): Promise<string | null> {
  const [row] = await db.select({ id: wallets.id }).from(wallets).where(eq(wallets.tokenHash, tokenHash));
  return row?.id ?? null;
}

export async function listOffers(walletId: string): Promise<OfferRow[]> {
  return db
    .select()
    .from(credentialOffers)
    .where(eq(credentialOffers.walletId, walletId))
    .orderBy(desc(credentialOffers.createdAt));
}

/** Sets claimed_at once; a second claim returns the offer unchanged. Null if the offer isn't this wallet's. */
export async function claimOffer(walletId: string, offerId: string, now: Date): Promise<OfferRow | null> {
  const mine = and(eq(credentialOffers.id, offerId), eq(credentialOffers.walletId, walletId));
  const [claimed] = await db
    .update(credentialOffers)
    .set({ claimedAt: now })
    .where(and(mine, isNull(credentialOffers.claimedAt)))
    .returning();
  if (claimed) return claimed;
  const [existing] = await db.select().from(credentialOffers).where(mine);
  return existing ?? null;
}

export async function upsertBackup(row: typeof walletBackups.$inferInsert): Promise<BackupRow> {
  const { walletId: _id, ...fields } = row;
  const [saved] = await db
    .insert(walletBackups)
    .values(row)
    .onConflictDoUpdate({ target: walletBackups.walletId, set: fields })
    .returning();
  if (!saved) throw new Error("backup upsert returned no row");
  return saved;
}

export async function findBackup(walletId: string): Promise<BackupRow | null> {
  const [row] = await db.select().from(walletBackups).where(eq(walletBackups.walletId, walletId));
  return row ?? null;
}
