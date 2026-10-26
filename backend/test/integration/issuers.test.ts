// V1-H1: issuers + keys against real Postgres and a local chain with the registries deployed.
import { randomUUID } from "node:crypto";
import { pubKeyHash } from "@zkred/zk-core";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { openBbsSecretKey, openGovernanceKey } from "../../src/core/issuers";
import { db, pool } from "../../src/db/client";
import { issuerKeys, issuers } from "../../src/db/schema";
import { getIssuer, getKey, provider } from "../../src/integrations/chain";
import { adminAuth, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();

describe.skipIf(!integrationEnabled)("issuers (integration)", () => {
  afterAll(async () => {
    await pool.end();
  });

  const create = (suffix = uniqueSuffix("uni")) =>
    request(app).post("/api/v1/issuers").set(adminAuth).send({ name: "Test University", kind: "university", did_suffix: suffix });

  it("POST /issuers registers the issuer on-chain, funds its governance wallet and stores encrypted secrets", async () => {
    const suffix = uniqueSuffix("uni");
    const res = await create(suffix).expect(201);
    const issuer = res.body;

    expect(issuer).toMatchObject({ did: `did:zkred:${suffix}`, name: "Test University", kind: "university", accredited: true });
    expect(issuer.keys).toHaveLength(1);
    const [key] = issuer.keys;
    expect(key.status).toBe("active");

    // On-chain state matches the DB.
    const onchainIssuer = await getIssuer(issuer.issuer_chain_id);
    expect(onchainIssuer).toEqual({ did: issuer.did, governance: issuer.governance_address, accredited: true });
    const onchainKey = await getKey(key.key_id);
    expect(onchainKey).toMatchObject({ issuerChainId: issuer.issuer_chain_id, status: "active", compromisedFrom: null });
    expect(onchainKey!.pubKeyHash).toBe(pubKeyHash(new Uint8Array(Buffer.from(key.public_key, "base64url"))));
    expect(onchainKey!.activeFrom.toISOString()).toBe(key.active_from);
    expect(await provider.getBalance(issuer.governance_address)).toBeGreaterThan(0n);

    // Secrets are encrypted at rest and decrypt to keys that match the public data.
    const [row] = await db.select().from(issuers).where(eq(issuers.id, issuer.id));
    const governanceKey = openGovernanceKey(row!.did, row!.governanceKeyEnc);
    expect(row!.governanceKeyEnc).not.toContain(governanceKey.slice(2));
    const [keyRow] = await db.select().from(issuerKeys).where(eq(issuerKeys.keyId, key.key_id));
    expect(openBbsSecretKey(key.key_id, keyRow!.secretKeyEnc)).toHaveLength(32);

    // Never leaks secrets over the API.
    expect(JSON.stringify(issuer)).not.toMatch(/secret|governance_key/i);
  });

  it("GET /issuers and GET /issuers/{id} return the issuer (public, no token)", async () => {
    const created = (await create().expect(201)).body;
    const list = await request(app).get("/api/v1/issuers").expect(200);
    expect(list.body.items.map((i: { id: string }) => i.id)).toContain(created.id);
    const one = await request(app).get(`/api/v1/issuers/${created.id}`).expect(200);
    expect(one.body).toEqual(created);
  });

  it("a duplicate did → 409 CONFLICT", async () => {
    const suffix = uniqueSuffix("dup");
    await create(suffix).expect(201);
    const res = await create(suffix).expect(409);
    expect(res.body.error.code).toBe("CONFLICT");
  });

  it("an unknown issuer → 404, a malformed id → 422", async () => {
    expect((await request(app).get(`/api/v1/issuers/${randomUUID()}`).expect(404)).body.error.code).toBe("NOT_FOUND");
    expect((await request(app).get("/api/v1/issuers/not-a-uuid").expect(422)).body.error.code).toBe("VALIDATION_ERROR");
    await request(app).post(`/api/v1/issuers/${randomUUID()}/keys/rotate`).set(adminAuth).expect(404);
  });

  it("POST /issuers/{id}/keys/rotate activates a new key and retires the old one on-chain and in the DB", async () => {
    const created = (await create().expect(201)).body;
    const oldKeyId = created.keys[0].key_id;

    const rotated = await request(app).post(`/api/v1/issuers/${created.id}/keys/rotate`).set(adminAuth).expect(200);
    expect(rotated.body.status).toBe("active");
    expect(rotated.body.key_id).not.toBe(oldKeyId);

    expect((await getKey(oldKeyId))!.status).toBe("rotated");
    expect((await getKey(rotated.body.key_id))!.status).toBe("active");

    const after = (await request(app).get(`/api/v1/issuers/${created.id}`).expect(200)).body;
    expect(after.keys.map((k: { key_id: string; status: string }) => [k.key_id, k.status])).toEqual([
      [oldKeyId, "rotated"],
      [rotated.body.key_id, "active"],
    ]);
  });

  it("concurrent rotations never leave two active keys", async () => {
    const created = (await create().expect(201)).body;
    const rotate = () => request(app).post(`/api/v1/issuers/${created.id}/keys/rotate`).set(adminAuth).expect(200);
    await Promise.all([rotate(), rotate()]);
    const after = (await request(app).get(`/api/v1/issuers/${created.id}`).expect(200)).body;
    expect(after.keys.filter((k: { status: string }) => k.status === "active")).toHaveLength(1);
    for (const k of after.keys) expect((await getKey(k.key_id))!.status).toBe(k.status);
  });
});
