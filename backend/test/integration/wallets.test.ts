// V1-H3: wallet endpoints. Auth tests first (TDD): a wallet token only ever opens its own wallet.
import { randomBytes, randomUUID } from "node:crypto";
import { walletCrypto } from "@zkred/zk-core";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { db, pool } from "../../src/db/client";
import { wallets } from "../../src/db/schema";
import { adminAuth, createIssuer, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";

async function newWallet() {
  const keys = await walletCrypto.generateWalletKeyPair();
  const display_name = uniqueSuffix("Holder");
  const res = await request(app).post(`${api}/wallets`).send({ display_name, enc_public_key: keys.publicKeyB64 }).expect(201);
  return { ...res.body, privateKeyJwk: keys.privateKeyJwk, publicKeyB64: keys.publicKeyB64 } as {
    id: string;
    display_name: string;
    wallet_token: string;
    privateKeyJwk: Awaited<ReturnType<typeof walletCrypto.generateWalletKeyPair>>["privateKeyJwk"];
    publicKeyB64: string;
  };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

async function backupFor(passphrase: string, data: unknown) {
  return { ...(await walletCrypto.encryptBackup(passphrase, data, 1000)), version: 1 };
}

describe.skipIf(!integrationEnabled)("wallets (integration)", () => {
  let issuer: Awaited<ReturnType<typeof createIssuer>>;

  beforeAll(async () => {
    issuer = await createIssuer(app);
  });

  afterAll(async () => {
    await pool.end();
  });

  const offerTo = (walletId: string) =>
    request(app)
      .post(`${api}/issuers/${issuer.id}/credentials`)
      .set(adminAuth)
      .send({
        credential_type: "MedicalLicense",
        wallet_id: walletId,
        claims: {
          holder_name: uniqueSuffix("name"),
          license_type: uniqueSuffix("type"),
          registration_no: uniqueSuffix("reg"),
          council: uniqueSuffix("council"),
          valid_until: "2040-01-31",
          license_status: uniqueSuffix("status"),
        },
      })
      .expect(201)
      .then((r) => r.body as { offer_id: string });

  describe("TDD: wallet token auth", () => {
    it("wallet A's token can't list, claim or back up wallet B (403); no or bad token → 401", async () => {
      const a = await newWallet();
      const b = await newWallet();
      const { offer_id } = await offerTo(b.id);
      await request(app).put(`${api}/wallets/${b.id}/backup`).set(auth(b.wallet_token)).send(await backupFor("pass-b", { x: 1 })).expect(200);

      const asA = auth(a.wallet_token);
      for (const call of [
        () => request(app).get(`${api}/wallets/${b.id}/offers`),
        () => request(app).post(`${api}/wallets/${b.id}/offers/${offer_id}/claim`),
        () => request(app).get(`${api}/wallets/${b.id}/backup`),
      ]) {
        expect((await call().set(asA).expect(403)).body.error.code).toBe("FORBIDDEN");
        expect((await call().expect(401)).body.error.code).toBe("UNAUTHORIZED");
        await call().set(auth(randomBytes(32).toString("base64url"))).expect(401);
      }
      await request(app).put(`${api}/wallets/${b.id}/backup`).set(asA).send(await backupFor("evil", {})).expect(403);

      // B's backup and offer are untouched.
      const backup = (await request(app).get(`${api}/wallets/${b.id}/backup`).set(auth(b.wallet_token)).expect(200)).body;
      expect(await walletCrypto.decryptBackup("pass-b", backup)).toEqual({ x: 1 });
      const offers = (await request(app).get(`${api}/wallets/${b.id}/offers`).set(auth(b.wallet_token)).expect(200)).body.items;
      expect(offers.find((o: { id: string }) => o.id === offer_id).claimed_at).toBeNull();
    });

    it("wallet A can't claim wallet B's offer through its own wallet path (404, not leaked)", async () => {
      const a = await newWallet();
      const b = await newWallet();
      const { offer_id } = await offerTo(b.id);
      await request(app).post(`${api}/wallets/${a.id}/offers/${offer_id}/claim`).set(auth(a.wallet_token)).expect(404);
    });

    it("the token is shown once and stored only as a hash", async () => {
      const a = await newWallet();
      const [row] = await db.select().from(wallets).where(eq(wallets.id, a.id));
      expect(row!.tokenHash).not.toContain(a.wallet_token);
      expect(JSON.stringify(row)).not.toContain(a.wallet_token);
      const lookup = (await request(app).get(`${api}/wallets/lookup`).query({ display_name: a.display_name }).expect(200)).body;
      expect(JSON.stringify(lookup)).not.toContain(a.wallet_token);
    });
  });

  it("POST /wallets validates input and rejects a taken display name (409)", async () => {
    const a = await newWallet();
    const { publicKeyB64 } = await walletCrypto.generateWalletKeyPair();
    expect((await request(app).post(`${api}/wallets`).send({ display_name: a.display_name, enc_public_key: publicKeyB64 }).expect(409)).body.error.code).toBe("CONFLICT");
    const shortName = (await request(app).post(`${api}/wallets`).send({ display_name: "x", enc_public_key: publicKeyB64 }).expect(422)).body;
    expect(Object.keys(shortName.error.details)).toEqual(["display_name"]);
    // 65 random bytes have the right length but are not a point on P-256: offers could never be encrypted to it.
    const notAKey = (await request(app).post(`${api}/wallets`).send({ display_name: uniqueSuffix("H"), enc_public_key: randomBytes(65).toString("base64url") }).expect(422)).body;
    expect(Object.keys(notAKey.error.details)).toEqual(["enc_public_key"]);
  });

  it("GET /wallets/lookup returns the public part only; unknown → 404", async () => {
    const a = await newWallet();
    const res = await request(app).get(`${api}/wallets/lookup`).query({ display_name: a.display_name }).expect(200);
    expect(res.body).toEqual({ id: a.id, display_name: a.display_name, enc_public_key: a.publicKeyB64 });
    await request(app).get(`${api}/wallets/lookup`).query({ display_name: uniqueSuffix("nobody") }).expect(404);
    await request(app).get(`${api}/wallets/lookup`).expect(422);
  });

  it("offers inbox → decrypt → claim (idempotent)", async () => {
    const a = await newWallet();
    const { offer_id } = await offerTo(a.id);
    const inbox = (await request(app).get(`${api}/wallets/${a.id}/offers`).set(auth(a.wallet_token)).expect(200)).body.items;
    expect(inbox).toHaveLength(1);
    const offer = inbox[0];
    expect(offer).toMatchObject({ id: offer_id, wallet_id: a.id, issuer_id: issuer.id, credential_type: "MedicalLicense", claimed_at: null });
    const cred = await walletCrypto.decryptOffer(a.privateKeyJwk, offer);
    expect(cred.issuer_did).toBe(issuer.did);

    const claimed = (await request(app).post(`${api}/wallets/${a.id}/offers/${offer_id}/claim`).set(auth(a.wallet_token)).expect(200)).body;
    expect(claimed.claimed_at).toEqual(expect.any(String));
    const again = (await request(app).post(`${api}/wallets/${a.id}/offers/${offer_id}/claim`).set(auth(a.wallet_token)).expect(200)).body;
    expect(again.claimed_at).toBe(claimed.claimed_at);
    await request(app).post(`${api}/wallets/${a.id}/offers/${randomUUID()}/claim`).set(auth(a.wallet_token)).expect(404);
  });

  it("backup: 404 before the first PUT, then PUT replaces and GET restores", async () => {
    const a = await newWallet();
    await request(app).get(`${api}/wallets/${a.id}/backup`).set(auth(a.wallet_token)).expect(404);
    const first = (await request(app).put(`${api}/wallets/${a.id}/backup`).set(auth(a.wallet_token)).send(await backupFor("pw", [1])).expect(200)).body;
    expect(first).toMatchObject({ wallet_id: a.id, kdf_iterations: 1000, version: 1, updated_at: expect.any(String) });
    await request(app).put(`${api}/wallets/${a.id}/backup`).set(auth(a.wallet_token)).send({ ...(await backupFor("pw", [1, 2])), version: 2 }).expect(200);
    const restored = (await request(app).get(`${api}/wallets/${a.id}/backup`).set(auth(a.wallet_token)).expect(200)).body;
    expect(restored.version).toBe(2);
    expect(await walletCrypto.decryptBackup("pw", restored)).toEqual([1, 2]);
    await request(app).put(`${api}/wallets/${a.id}/backup`).set(auth(a.wallet_token)).send({ ciphertext: "!!", iv: "", salt: "", kdf_iterations: 0, version: 1 }).expect(422);
  });
});
