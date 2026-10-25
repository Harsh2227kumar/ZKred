// verifiers, presentation_requests, verifications.
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { db } from "../client";
import { presentationRequests, verifications, verifiers } from "../schema";

export type VerifierRow = typeof verifiers.$inferSelect;
export type RequestRow = typeof presentationRequests.$inferSelect;
export type VerificationRow = typeof verifications.$inferSelect;

export async function insertVerifier(row: { name: string; did: string }): Promise<VerifierRow> {
  const [created] = await db.insert(verifiers).values(row).returning();
  if (!created) throw new Error("verifier insert returned no row");
  return created;
}

export async function listVerifiers(): Promise<VerifierRow[]> {
  return db.select().from(verifiers).orderBy(asc(verifiers.createdAt));
}

export async function findVerifier(id: string): Promise<VerifierRow | null> {
  const [row] = await db.select().from(verifiers).where(eq(verifiers.id, id));
  return row ?? null;
}

export async function insertRequest(row: typeof presentationRequests.$inferInsert): Promise<RequestRow> {
  const [created] = await db.insert(presentationRequests).values(row).returning();
  if (!created) throw new Error("presentation request insert returned no row");
  return created;
}

/** The request with its verifier's name, or null. */
export async function findRequest(id: string): Promise<{ request: RequestRow; verifierName: string } | null> {
  const [row] = await db
    .select({ request: presentationRequests, verifierName: verifiers.name })
    .from(presentationRequests)
    .innerJoin(verifiers, eq(verifiers.id, presentationRequests.verifierId))
    .where(eq(presentationRequests.id, id));
  return row ?? null;
}

export async function listVerifications(requestId: string): Promise<VerificationRow[]> {
  return db
    .select()
    .from(verifications)
    .where(eq(verifications.requestId, requestId))
    .orderBy(desc(verifications.createdAt));
}

/**
 * Stores a verification. An accepted one also consumes the request nonce in the same transaction; if another
 * presentation consumed it first, nothing is stored and null is returned (the caller answers NONCE_USED).
 */
export async function recordVerification(row: typeof verifications.$inferInsert, now: Date): Promise<VerificationRow | null> {
  return db.transaction(async (tx) => {
    if (row.result === "accepted") {
      const [consumed] = await tx
        .update(presentationRequests)
        .set({ nonceUsedAt: now })
        .where(and(eq(presentationRequests.id, row.requestId), isNull(presentationRequests.nonceUsedAt)))
        .returning({ id: presentationRequests.id });
      if (!consumed) return null;
    }
    const [created] = await tx.insert(verifications).values(row).returning();
    if (!created) throw new Error("verification insert returned no row");
    return created;
  });
}
