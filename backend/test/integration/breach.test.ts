// V1.2-H2: breach response + re-issue against real Postgres + a local chain, from the attacker's side. The end-to-end
// story (forged ✓ → report → forged ✗, legacy ✓, re-issued ✓) lives in presentations.test.ts; these are the attempts
// to get past re-issue (laundering) and the compromise report's own rules.
import { randomBytes, randomUUID } from "node:crypto";
import { CREDENTIAL_LAYOUTS, signCredential, walletCrypto, type CredentialType, type SignedCredential } from "@zkred/zk-core";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { openBbsSecretKey } from "../../src/core/issuers";
import { db, pool } from "../../src/db/client";
import { insertBatch } from "../../src/db/repositories/issuance.repo";
import { findActiveKeyWithSecret } from "../../src/db/repositories/issuers.repo";
import { attackForgeries } from "../../src/db/schema";
import { adminAuth, createIssuer, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";

type Issuer = Awaited<ReturnType<typeof createIssuer>>;
interface Holder {
  id: string;
  auth: { Authorization: string };
  privateKeyJwk: Awaited<ReturnType<typeof walletCrypto.generateWalletKeyPair>>["privateKeyJwk"];
}

async function newHolder(): Promise<Holder> {
  const keys = await walletCrypto.generateWalletKeyPair();
  const res = await request(app).post(`${api}/wallets`).send({ display_name: uniqueSuffix("holder"), enc_public_key: keys.publicKeyB64 }).expect(201);
  return { id: res.body.id, auth: { Authorization: `Bearer ${res.body.wallet_token}` }, privateKeyJwk: keys.privateKeyJwk };
}

function claimsFor(type: CredentialType): Record<string, string | number> {
  const claims: Record<string, string | number> = {};
  for (const f of CREDENTIAL_LAYOUTS[type].fields.filter((x) => x.source === "claim")) {
    claims[f.name] = f.kind === "int" ? 2016 : f.kind === "date" ? "1994-02-11" : uniqueSuffix(f.name);
  }
  return claims;
}

/** Issues a Degree, anchors its batch and claims it into the holder's "wallet" (decrypted locally, like the browser). */
async function issueAnchored(issuer: Issuer, holder: Holder): Promise<{ credentialId: string; batchId: string; cred: SignedCredential }> {
  const out = (
    await request(app)
      .post(`${api}/issuers/${issuer.id}/credentials`)
      .set(adminAuth)
      .send({ credential_type: "Degree", wallet_id: holder.id, claims: claimsFor("Degree") })
      .expect(201)
  ).body;
  await request(app).post(`${api}/issuers/${issuer.id}/batches/${out.batch_id}/anchor`).set(adminAuth).expect(200);
  return { credentialId: out.credential_id, batchId: out.batch_id, cred: await receive(holder, out.offer_id) };
}

async function receive(holder: Holder, offerId: string): Promise<SignedCredential> {
  const offers = (await request(app).get(`${api}/wallets/${holder.id}/offers`).set(holder.auth).expect(200)).body.items;
  return walletCrypto.decryptOffer(holder.privateKeyJwk, offers.find((o: { id: string }) => o.id === offerId));
}

const report = (issuer: Issuer, keyId: string, body: object) =>
  request(app).post(`${api}/issuers/${issuer.id}/keys/${keyId}/compromise`).set(adminAuth).send(body);
const reissue = (issuer: Issuer, holder: Holder, old: unknown) =>
  request(app).post(`${api}/issuers/${issuer.id}/reissue`).set(holder.auth).send({ wallet_id: holder.id, old_credential: old });

describe.skipIf(!integrationEnabled)("breach response + re-issue (integration)", () => {
  let holder: Holder;

  beforeAll(async () => {
    holder = await newHolder();
  });

  afterAll(async () => {
    await request(app).post(`${api}/attack/reset`).set(adminAuth);
    await pool.end();
  });

  it("re-issue refuses a stolen-key forgery that reuses an honest serial (no laundering of upgraded claims)", async () => {
    // Mallory holds one honest in-window degree AND the stolen signing key.
    const school = await createIssuer(app, "university");
    const mallory = await newHolder();
    const honest = await issueAnchored(school, mallory);
    const key = (await findActiveKeyWithSecret(school.id))!;
    const upgraded = await signCredential({
      secretKey: openBbsSecretKey(key.keyId, key.secretKeyEnc),
      publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
      type: "Degree",
      values: { ...honest.cred.values, degree_name: uniqueSuffix("forged-degree") },
    });
    expect(upgraded.values.commitment).toBe(honest.cred.values.commitment);

    await report(school, key.keyId, { window_seconds: 600 }).expect(200);
    const refused = await reissue(school, mallory, upgraded).expect(403);
    expect(refused.body.error.details.old_credential).toMatch(/not the credential this issuer signed/);

    // The genuine copy is refreshed, with the claims the registrar actually signed.
    const fresh = await receive(mallory, (await reissue(school, mallory, honest.cred).expect(201)).body.offer_id);
    expect(fresh.values.degree_name).toBe(honest.cred.values.degree_name);
    expect(fresh.key_id).not.toBe(key.keyId);
  });

  it("re-issue refuses an attack-console forgery (signed + anchored, not in the records) and a revoked in-window credential", async () => {
    const school = await createIssuer(app, "university");
    const revoked = await issueAnchored(school, holder);
    await request(app).post(`${api}/issuers/${school.id}/credentials/${revoked.credentialId}/revoke`).set(adminAuth).expect(200);

    const stolen = (await request(app).post(`${api}/attack/steal-key`).set(adminAuth).send({ issuer_id: school.id }).expect(200)).body;
    await request(app).post(`${api}/attack/forge`).set(adminAuth).send({ issuer_id: school.id, count: 1, claims: claimsFor("Degree") }).expect(200);
    const [forgery] = await db.select().from(attackForgeries).where(eq(attackForgeries.issuerId, school.id));
    await report(school, stolen.key_id, { window_seconds: 600 }).expect(200);

    const forged = await reissue(school, holder, forgery!.credential).expect(403);
    expect(forged.body.error.details.old_credential).toMatch(/not in the issuer's records/);
    const refusedRevoked = await reissue(school, holder, revoked.cred).expect(403);
    expect(refusedRevoked.body.error.details.old_credential).toBe("revoked");
  });

  it("re-issue: malformed body → 422, another wallet's token → 403, unknown issuer → 404", async () => {
    const school = await createIssuer(app, "university");
    const issued = await issueAnchored(school, holder);
    await request(app).post(`${api}/issuers/${school.id}/reissue`).set(holder.auth).send({ wallet_id: holder.id }).expect(422);
    await request(app).post(`${api}/issuers/${school.id}/reissue`).set(holder.auth).send({ wallet_id: holder.id, old_credential: { ...issued.cred, key_id: "0x12" } }).expect(422);
    const other = await newHolder();
    await request(app).post(`${api}/issuers/${school.id}/reissue`).set(other.auth).send({ wallet_id: holder.id, old_credential: issued.cred }).expect(403);
    await request(app).post(`${api}/issuers/${randomUUID()}/reissue`).set(holder.auth).send({ wallet_id: holder.id, old_credential: issued.cred }).expect(404);
  });

  it("compromise report: re-reporting never moves the cutoff later, empty batches are not listed, bad keys → 404 / 422", async () => {
    const school = await createIssuer(app, "university");
    const keyId = school.keys[0]!.key_id;
    const issued = await issueAnchored(school, holder);
    // A batch row left empty (an issuance that failed after opening it) affects no holder.
    const empty = await insertBatch({ batchId: `0x${randomBytes(32).toString("hex")}`, issuerId: school.id, keyId });

    const first = (await report(school, keyId, { window_seconds: 600 }).expect(200)).body;
    expect(first.affected_batches).toEqual([expect.objectContaining({ batch_id: issued.batchId, verdict: "in_window_needs_reissue" })]);
    expect(first.tx_hashes).toHaveLength(2); // markCompromised + rotateKey
    const narrower = (await report(school, keyId, { window_seconds: 60 }).expect(200)).body;
    expect(narrower).toMatchObject({ compromised_from: first.compromised_from, tx_hashes: [], new_key: { key_id: first.new_key.key_id } });
    const wider = (await report(school, keyId, { window_seconds: 7200 }).expect(200)).body;
    expect(new Date(wider.compromised_from).getTime()).toBeLessThan(new Date(first.compromised_from).getTime());
    expect(wider.tx_hashes).toHaveLength(1);
    expect(wider.affected_batches.map((b: { batch_id: string }) => b.batch_id)).not.toContain(empty.batchId);

    const otherIssuer = await createIssuer(app, "government");
    await report(otherIssuer, keyId, {}).expect(404);
    await report(school, `0x${randomBytes(32).toString("hex")}`, {}).expect(404);
    await report(school, keyId, { window_seconds: 0 }).expect(422);
    await request(app).post(`${api}/issuers/${school.id}/keys/not-hex/compromise`).set(adminAuth).send({}).expect(422);
  });
});
