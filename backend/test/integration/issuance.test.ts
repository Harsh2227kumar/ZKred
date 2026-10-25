// V1-H2: issuance, batches, anchoring and status lists against real Postgres + a local chain.
import { randomUUID } from "node:crypto";
import {
  CREDENTIAL_LAYOUTS,
  dateToDays,
  dobCommitment,
  merkleRoot,
  statusList,
  verifyCredential,
  walletCrypto,
  type CredentialType,
  type Hex32,
} from "@zkred/zk-core";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { db, pool } from "../../src/db/client";
import { credentialOffers, issuedCredentials } from "../../src/db/schema";
import { getAnchor, getListHash } from "../../src/integrations/chain";
import { adminAuth, createIssuer, createWalletRow, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";

/** Random claims for every claim field of `type` (dates in the past, ints as numbers). */
function claimsFor(type: CredentialType): Record<string, string | number> {
  const claims: Record<string, string | number> = {};
  for (const f of CREDENTIAL_LAYOUTS[type].fields.filter((x) => x.source === "claim")) {
    if (f.kind === "date") claims[f.name] = new Date(Date.UTC(1980 + Math.floor(Math.random() * 20), 4, 17)).toISOString().slice(0, 10);
    else if (f.kind === "int") claims[f.name] = 2000 + Math.floor(Math.random() * 20);
    else claims[f.name] = uniqueSuffix(f.name);
  }
  return claims;
}

const issue = (issuerId: string, walletId: string, type: CredentialType, claims = claimsFor(type)) =>
  request(app).post(`${api}/issuers/${issuerId}/credentials`).set(adminAuth).send({ credential_type: type, wallet_id: walletId, claims });

describe.skipIf(!integrationEnabled)("issuance (integration)", () => {
  let issuer: Awaited<ReturnType<typeof createIssuer>>;
  let wallet: Awaited<ReturnType<typeof createWalletRow>>;

  beforeAll(async () => {
    issuer = await createIssuer(app);
    wallet = await createWalletRow();
  });

  afterAll(async () => {
    await pool.end();
  });

  it("signs a credential the holder can decrypt and verify; the DB keeps no claims", async () => {
    const claims = claimsFor("Degree");
    const out = (await issue(issuer.id, wallet.id, "Degree", claims).expect(201)).body;

    const [offerRow] = await db.select().from(credentialOffers).where(eq(credentialOffers.id, out.offer_id));
    const cred = await walletCrypto.decryptOffer(wallet.privateKeyJwk, {
      ephemeral_public_key: offerRow!.ephemeralPublicKey,
      iv: offerRow!.iv,
      ciphertext: offerRow!.ciphertext,
    });
    const publicKey = new Uint8Array(Buffer.from(issuer.keys[0]!.public_key, "base64url"));
    expect(await verifyCredential(cred, publicKey)).toBe(true);
    expect(cred.values).toMatchObject({
      cred_type: "Degree",
      issuer_did: issuer.did,
      key_id: issuer.keys[0]!.key_id,
      batch_id: out.batch_id,
      status_list_id: out.status_list_id,
      status_index: String(out.status_index),
      commitment: out.commitment,
      holder_name: claims.holder_name,
      graduation_year: String(claims.graduation_year),
    });

    const [record] = await db.select().from(issuedCredentials).where(eq(issuedCredentials.id, out.credential_id));
    expect(JSON.stringify(record)).not.toContain(String(claims.holder_name));
    expect(offerRow!.ciphertext).not.toContain(String(claims.holder_name));
  });

  it("GovernmentId gets a server-derived dob_commitment = Poseidon(dob_days, dob_salt)", async () => {
    const claims = claimsFor("GovernmentId");
    const out = (await issue(issuer.id, wallet.id, "GovernmentId", claims).expect(201)).body;
    const [offerRow] = await db.select().from(credentialOffers).where(eq(credentialOffers.id, out.offer_id));
    const cred = await walletCrypto.decryptOffer(wallet.privateKeyJwk, {
      ephemeral_public_key: offerRow!.ephemeralPublicKey,
      iv: offerRow!.iv,
      ciphertext: offerRow!.ciphertext,
    });
    expect(cred.values.dob).toBe(claims.dob);
    expect(cred.values.dob_commitment).toBe(
      await dobCommitment(BigInt(dateToDays(String(claims.dob))), BigInt(cred.values.dob_salt!)),
    );
  });

  it("TDD: concurrent issuance gives every credential its own status slot and batch leaf", async () => {
    const own = await createIssuer(app);
    const types: CredentialType[] = ["Degree", "MedicalLicense", "GovernmentId"];
    const outs = (
      await Promise.all(Array.from({ length: 9 }, (_, i) => issue(own.id, wallet.id, types[i % 3]!).expect(201)))
    ).map((r) => r.body);

    const slots = outs.map((o) => `${o.status_list_id}#${o.status_index}`);
    expect(new Set(slots).size).toBe(outs.length);
    expect(outs.map((o) => o.status_index).sort((a, b) => a - b)).toEqual(outs.map((_, i) => i));

    const batchIds = new Set(outs.map((o) => o.batch_id));
    expect(batchIds.size).toBe(1);
    const leaves = (await request(app).get(`${api}/batches/${outs[0].batch_id}/leaves`).expect(200)).body;
    expect(leaves.root).toBeNull();
    expect([...leaves.leaves].sort()).toEqual(outs.map((o) => o.commitment).sort());
  });

  it("TDD: anchors root = merkleRoot(leaves) on-chain at chain time; a new batch opens afterwards", async () => {
    const own = await createIssuer(app);
    const first = (await issue(own.id, wallet.id, "Degree").expect(201)).body;
    await issue(own.id, wallet.id, "MedicalLicense").expect(201);

    const anchored = (await request(app).post(`${api}/issuers/${own.id}/batches/${first.batch_id}/anchor`).set(adminAuth).expect(200)).body;
    const { leaves } = (await request(app).get(`${api}/batches/${first.batch_id}/leaves`).expect(200)).body;
    expect(anchored).toMatchObject({ batch_id: first.batch_id, status: "anchored", size: 2, root: merkleRoot(leaves) });

    const onchain = await getAnchor(first.batch_id);
    expect(onchain!.root).toBe(anchored.root);
    expect(onchain!.keyId).toBe(own.keys[0]!.key_id);
    expect(onchain!.anchoredAt.toISOString()).toBe(anchored.anchored_at);

    // Re-anchoring is refused; the next credential goes into a fresh open batch.
    expect((await request(app).post(`${api}/issuers/${own.id}/batches/${first.batch_id}/anchor`).set(adminAuth).expect(409)).body.error.code).toBe("CONFLICT");
    const next = (await issue(own.id, wallet.id, "Degree").expect(201)).body;
    expect(next.batch_id).not.toBe(first.batch_id);

    const batches = (await request(app).get(`${api}/issuers/${own.id}/batches`).expect(200)).body.items;
    expect(batches.map((b: { batch_id: string; status: string }) => [b.batch_id, b.status])).toEqual([
      [next.batch_id, "open"],
      [first.batch_id, "anchored"],
    ]);
  });

  it("a batch signed by a rotated key can no longer be anchored (409), new issuance uses the new key", async () => {
    const own = await createIssuer(app);
    const before = (await issue(own.id, wallet.id, "Degree").expect(201)).body;
    const newKey = (await request(app).post(`${api}/issuers/${own.id}/keys/rotate`).set(adminAuth).expect(200)).body;
    await request(app).post(`${api}/issuers/${own.id}/batches/${before.batch_id}/anchor`).set(adminAuth).expect(409);
    const after = (await issue(own.id, wallet.id, "Degree").expect(201)).body;
    expect(after.batch_id).not.toBe(before.batch_id);
    const batch = (await request(app).get(`${api}/issuers/${own.id}/batches`).expect(200)).body.items[0];
    expect(batch.key_id).toBe(newKey.key_id);
  });

  it("GET /status-lists/{id}: herd list whose hash matches the on-chain hash", async () => {
    const out = (await issue(issuer.id, wallet.id, "Degree").expect(201)).body;
    const list = (await request(app).get(`${api}/status-lists/${out.status_list_id}`).expect(200)).body;
    expect(list.hash).toBe(list.onchain_hash);
    expect((await getListHash(out.status_list_id))!.listHash).toBe(list.hash);
    const bits = statusList.decode(list.encoded);
    expect(statusList.hash(bits)).toBe(list.hash);
    expect(bits.length * 8).toBe(list.size);
    expect(statusList.getBit(bits, out.status_index)).toBe(false);
  });

  it("GET /issuers/{id}/credentials pages newest first with a cursor and never returns claims", async () => {
    const own = await createIssuer(app);
    for (let i = 0; i < 3; i++) await issue(own.id, wallet.id, "Degree").expect(201);
    const url = `${api}/issuers/${own.id}/credentials`;
    const p1 = (await request(app).get(url).query({ limit: 2 }).set(adminAuth).expect(200)).body;
    expect(p1.items).toHaveLength(2);
    expect(p1.next_cursor).toEqual(expect.any(String));
    const p2 = (await request(app).get(url).query({ limit: 2, cursor: p1.next_cursor }).set(adminAuth).expect(200)).body;
    expect(p2.items).toHaveLength(1);
    expect(p2.next_cursor).toBeNull();
    const ids = [...p1.items, ...p2.items].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(3);
    expect(Object.keys(p1.items[0]).sort()).toEqual(
      ["batch_id", "commitment", "credential_type", "id", "issued_at", "key_id", "revoked_at", "status_index", "wallet_id"].sort(),
    );

    await request(app).get(url).expect(401);
    expect((await request(app).get(url).query({ cursor: "garbage" }).set(adminAuth).expect(422)).body.error.code).toBe("VALIDATION_ERROR");
    await request(app).get(url).query({ limit: 0 }).set(adminAuth).expect(422);
  });

  it("bad requests are 4xx, never 500", async () => {
    const bad = async (status: number, body: object, issuerId = issuer.id) =>
      request(app).post(`${api}/issuers/${issuerId}/credentials`).set(adminAuth).send(body).expect(status);

    const unknownClaim = (await bad(422, { credential_type: "Degree", wallet_id: wallet.id, claims: { ...claimsFor("Degree"), ssn: "x" } })).body;
    expect(unknownClaim.error.details).toHaveProperty(["claims.ssn"]);
    const { holder_name: _omit, ...missing } = claimsFor("Degree");
    expect((await bad(422, { credential_type: "Degree", wallet_id: wallet.id, claims: missing })).body.error.details).toHaveProperty(["claims.holder_name"]);
    expect((await bad(422, { credential_type: "GovernmentId", wallet_id: wallet.id, claims: { ...claimsFor("GovernmentId"), dob: "1990-02-30" } })).body.error.details).toHaveProperty(["claims.dob"]);
    expect((await bad(422, { credential_type: "Degree", wallet_id: randomUUID(), claims: claimsFor("Degree") })).body.error.details).toHaveProperty("wallet_id");
    await bad(422, { credential_type: "Passport", wallet_id: wallet.id, claims: {} });
    await bad(404, { credential_type: "Degree", wallet_id: wallet.id, claims: claimsFor("Degree") }, randomUUID());

    await request(app).post(`${api}/issuers/${issuer.id}/credentials`).send({}).expect(401);
    await request(app).get(`${api}/batches/0x${"ab".repeat(32)}/leaves`).expect(404);
    await request(app).get(`${api}/batches/not-hex/leaves`).expect(422);
    await request(app).get(`${api}/status-lists/0x${"cd".repeat(32)}`).expect(404);
    await request(app).post(`${api}/issuers/${issuer.id}/batches/0x${"ef".repeat(32)}/anchor`).set(adminAuth).expect(404);
  });
});
