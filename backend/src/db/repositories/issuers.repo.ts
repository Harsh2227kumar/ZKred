// issuers + issuer_keys. Secrets come back only from the *WithSecrets readers, and only as ciphertext.
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "../client";
import { issuerKeys, issuers } from "../schema";

export type IssuerRow = typeof issuers.$inferSelect;
export type IssuerKeyRow = typeof issuerKeys.$inferSelect;
export type NewIssuerRow = typeof issuers.$inferInsert;
export type NewIssuerKeyRow = Omit<typeof issuerKeys.$inferInsert, "issuerId">;

/** Public view: the encrypted secrets are left out. */
export type IssuerKeyRecord = Omit<IssuerKeyRow, "secretKeyEnc">;
export type IssuerRecord = Omit<IssuerRow, "governanceKeyEnc"> & { keys: IssuerKeyRecord[] };

const publicIssuerColumns = {
  id: issuers.id,
  did: issuers.did,
  name: issuers.name,
  kind: issuers.kind,
  issuerChainId: issuers.issuerChainId,
  governanceAddress: issuers.governanceAddress,
  createdAt: issuers.createdAt,
};

const publicKeyColumns = {
  id: issuerKeys.id,
  issuerId: issuerKeys.issuerId,
  keyId: issuerKeys.keyId,
  publicKey: issuerKeys.publicKey,
  status: issuerKeys.status,
  activeFrom: issuerKeys.activeFrom,
  compromisedFrom: issuerKeys.compromisedFrom,
  txHash: issuerKeys.txHash,
  createdAt: issuerKeys.createdAt,
};

async function keysByIssuer(issuerIds: string[]): Promise<Map<string, IssuerKeyRecord[]>> {
  const out = new Map<string, IssuerKeyRecord[]>(issuerIds.map((id) => [id, []]));
  if (issuerIds.length === 0) return out;
  const rows = await db
    .select(publicKeyColumns)
    .from(issuerKeys)
    .where(inArray(issuerKeys.issuerId, issuerIds))
    .orderBy(asc(issuerKeys.activeFrom), asc(issuerKeys.createdAt));
  for (const row of rows) out.get(row.issuerId)?.push(row);
  return out;
}

export async function listIssuers(): Promise<IssuerRecord[]> {
  const rows = await db.select(publicIssuerColumns).from(issuers).orderBy(asc(issuers.createdAt));
  const keys = await keysByIssuer(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, keys: keys.get(r.id) ?? [] }));
}

export async function findIssuer(id: string): Promise<IssuerRecord | null> {
  const [row] = await db.select(publicIssuerColumns).from(issuers).where(eq(issuers.id, id));
  if (!row) return null;
  const keys = await db
    .select(publicKeyColumns)
    .from(issuerKeys)
    .where(eq(issuerKeys.issuerId, id))
    .orderBy(asc(issuerKeys.activeFrom), asc(issuerKeys.createdAt));
  return { ...row, keys };
}

/** Public issuer row by DID (no keys, no secrets), or null. */
export async function findIssuerByDid(did: string): Promise<Omit<IssuerRow, "governanceKeyEnc"> | null> {
  const [row] = await db.select(publicIssuerColumns).from(issuers).where(eq(issuers.did, did));
  return row ?? null;
}

/** Public key row by its on-chain key id (no secret), or null. */
export async function findKey(keyId: string): Promise<IssuerKeyRecord | null> {
  const [row] = await db.select(publicKeyColumns).from(issuerKeys).where(eq(issuerKeys.keyId, keyId));
  return row ?? null;
}

export async function didExists(did: string): Promise<boolean> {
  const [row] = await db.select({ id: issuers.id }).from(issuers).where(eq(issuers.did, did));
  return Boolean(row);
}

export async function findIssuerWithSecrets(id: string): Promise<IssuerRow | null> {
  const [row] = await db.select().from(issuers).where(eq(issuers.id, id));
  return row ?? null;
}

/** The issuer's current signing key (with its encrypted secret), or null when none is active. */
export async function findActiveKeyWithSecret(issuerId: string): Promise<IssuerKeyRow | null> {
  const [row] = await db
    .select()
    .from(issuerKeys)
    .where(and(eq(issuerKeys.issuerId, issuerId), eq(issuerKeys.status, "active")));
  return row ?? null;
}

export async function insertIssuerWithKey(issuer: NewIssuerRow, key: NewIssuerKeyRow): Promise<string> {
  return db.transaction(async (tx) => {
    const [created] = await tx.insert(issuers).values(issuer).returning({ id: issuers.id });
    if (!created) throw new Error("issuer insert returned no row");
    await tx.insert(issuerKeys).values({ ...key, issuerId: created.id });
    return created.id;
  });
}

/** Marks `oldKeyId` rotated (a compromised key keeps its status, as on-chain) and stores the new active key. */
export async function recordKeyRotation(issuerId: string, oldKeyId: string, newKey: NewIssuerKeyRow): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(issuerKeys)
      .set({ status: "rotated" })
      .where(and(eq(issuerKeys.keyId, oldKeyId), eq(issuerKeys.status, "active")));
    await tx.insert(issuerKeys).values({ ...newKey, issuerId });
  });
}

/**
 * Marks `keyId` compromised from `compromisedFrom` and, when the compromised key was the active one, stores the
 * replacement key that the chain just activated. One transaction, so the issuer never has two active keys.
 */
export async function recordCompromise(
  issuerId: string,
  keyId: string,
  compromisedFrom: Date,
  newKey: NewIssuerKeyRow | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(issuerKeys).set({ status: "compromised", compromisedFrom }).where(eq(issuerKeys.keyId, keyId));
    if (newKey) await tx.insert(issuerKeys).values({ ...newKey, issuerId });
  });
}
