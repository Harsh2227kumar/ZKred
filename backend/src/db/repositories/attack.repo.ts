// attack_state, attack_forgeries, attack_runs (DEMO_MODE red-team console). Never touches issued_credentials.
import { count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import { attackForgeries, attackRuns, attackState } from "../schema";

export type StolenKeyRow = typeof attackState.$inferSelect;
export type ForgeryRow = typeof attackForgeries.$inferSelect;
export type RunRow = typeof attackRuns.$inferSelect;

export async function insertStolenKey(row: { issuerId: string; keyId: string; secretKeyEnc: string }): Promise<StolenKeyRow> {
  const [created] = await db.insert(attackState).values(row).returning();
  if (!created) throw new Error("attack_state insert returned no row");
  return created;
}

/** The most recently stolen key of `issuerId`, or null. */
export async function latestStolenKey(issuerId: string): Promise<StolenKeyRow | null> {
  const [row] = await db
    .select()
    .from(attackState)
    .where(eq(attackState.issuerId, issuerId))
    .orderBy(desc(attackState.stolenAt))
    .limit(1);
  return row ?? null;
}

export async function listStolenKeys(): Promise<StolenKeyRow[]> {
  return db.select().from(attackState).orderBy(desc(attackState.stolenAt));
}

export async function insertForgeries(rows: { forgedSetId: string; issuerId: string; credential: unknown }[]): Promise<void> {
  if (rows.length) await db.insert(attackForgeries).values(rows);
}

export async function listForgeries(): Promise<ForgeryRow[]> {
  return db.select().from(attackForgeries).orderBy(attackForgeries.createdAt);
}

export async function countForgeries(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(attackForgeries);
  return row?.n ?? 0;
}

export async function insertRun(row: typeof attackRuns.$inferInsert): Promise<RunRow> {
  const [created] = await db.insert(attackRuns).values(row).returning();
  if (!created) throw new Error("attack_runs insert returned no row");
  return created;
}

export async function listRuns(): Promise<RunRow[]> {
  return db.select().from(attackRuns).orderBy(desc(attackRuns.ranAt));
}

/** Clears the attack tables only: never the chain, issuers or real credentials. */
export async function resetAttack(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(attackRuns);
    await tx.delete(attackForgeries);
    await tx.delete(attackState);
  });
}
