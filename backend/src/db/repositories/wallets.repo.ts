// wallets (+ offers and backups from V1-H3). Never holds plaintext holder claims.
import { eq } from "drizzle-orm";
import { db } from "../client";
import { wallets } from "../schema";

export async function findWalletEncryptionKey(walletId: string): Promise<string | null> {
  const [row] = await db.select({ encPublicKey: wallets.encPublicKey }).from(wallets).where(eq(wallets.id, walletId));
  return row?.encPublicKey ?? null;
}
