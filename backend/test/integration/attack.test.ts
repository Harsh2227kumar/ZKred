// V1.2-H3: the attack console's counters against real Postgres + a local chain. Every forgery is counted once, under
// the code the real engine gives it; by_code always sums to `rejected`; reset clears only the attack tables.
import { randomBytes, randomUUID } from "node:crypto";
import { CREDENTIAL_LAYOUTS, generateIssuerKeyPair, signCredential, type SignedCredential } from "@zkred/zk-core";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { openBbsSecretKey } from "../../src/core/issuers";
import { db, pool } from "../../src/db/client";
import { insertForgeries } from "../../src/db/repositories/attack.repo";
import { findKey } from "../../src/db/repositories/issuers.repo";
import { attackForgeries, attackState } from "../../src/db/schema";
import { adminAuth, createIssuer, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";

const degreeClaims = (): Record<string, string | number> =>
  Object.fromEntries(
    CREDENTIAL_LAYOUTS.Degree.fields
      .filter((f) => f.source === "claim")
      .map((f) => [f.name, f.kind === "int" ? 2019 : uniqueSuffix(f.name)]),
  );

const attack = (path: string, body: object = {}) => request(app).post(`${api}/attack/${path}`).set(adminAuth).send(body);
const state = async () => (await request(app).get(`${api}/attack/state`).set(adminAuth).expect(200)).body;
const run = async (mode: "full" | "naive") => (await attack("verify-forged", { mode }).expect(200)).body;
const sum = (byCode: Record<string, number>) => Object.values(byCode).reduce((a, b) => a + b, 0);

describe.skipIf(!integrationEnabled)("attack console counters (integration)", () => {
  let school: Awaited<ReturnType<typeof createIssuer>>;

  beforeAll(async () => {
    await attack("reset").expect(200);
    school = await createIssuer(app, "university");
  });

  afterAll(async () => {
    await attack("reset");
    await pool.end();
  });

  it("steal + forge validate their input: unknown issuer → 404, forge before steal → 409, bad count / claims → 422", async () => {
    expect(await state()).toEqual({ stolen_keys: [], forged_count: 0, runs: [] });
    await attack("steal-key", { issuer_id: randomUUID() }).expect(404);
    await attack("steal-key", { issuer_id: "not-a-uuid" }).expect(422);
    await attack("forge", { issuer_id: school.id, count: 1, claims: degreeClaims() }).expect(409);
    await attack("forge", { issuer_id: randomUUID(), count: 1, claims: degreeClaims() }).expect(404);
    for (const count of [0, 1001, 2.5]) await attack("forge", { issuer_id: school.id, count, claims: degreeClaims() }).expect(422);
    await attack("verify-forged", { mode: "lenient" }).expect(422);
  });

  it("counters: full ✓ before the report, ✗ after with the engine's own codes; naive stays fooled; reset clears only attack data", async () => {
    const stolen = (await attack("steal-key", { issuer_id: school.id }).expect(200)).body;
    expect(stolen.key_id).toBe(school.keys[0]!.key_id);
    await attack("forge", { issuer_id: school.id, count: 1, claims: { ...degreeClaims(), graduation_year: "not-a-year" } }).expect(422);
    const forged = (await attack("forge", { issuer_id: school.id, count: 4, claims: degreeClaims() }).expect(200)).body;
    expect(forged).toMatchObject({ forged_count: 4, anchor_tx_hash: expect.stringMatching(/^0x/) });

    expect(await run("full")).toMatchObject({ mode: "full", total: 4, accepted: 4, rejected: 0, by_code: {} });
    expect(await run("naive")).toMatchObject({ mode: "naive", total: 4, accepted: 4, rejected: 0 });

    await request(app).post(`${api}/issuers/${school.id}/keys/${stolen.key_id}/compromise`).set(adminAuth).send({ window_seconds: 600 }).expect(200);
    // The stolen key can no longer anchor: these stay in an open batch.
    expect((await attack("forge", { issuer_id: school.id, count: 2, claims: degreeClaims() }).expect(200)).body.anchor_tx_hash).toBeNull();

    // Two more the pipeline never saw: one claims a batch no one has, one is signed by a key no registry knows.
    const [sample] = await db.select().from(attackForgeries).where(eq(attackForgeries.issuerId, school.id)).limit(1);
    const base = sample!.credential as SignedCredential;
    const key = (await findKey(stolen.key_id))!;
    const [secret] = await db.select().from(attackState).where(eq(attackState.keyId, stolen.key_id));
    const strayBatch = await signCredential({
      secretKey: openBbsSecretKey(stolen.key_id, secret!.secretKeyEnc),
      publicKey: new Uint8Array(Buffer.from(key.publicKey, "base64url")),
      type: "Degree",
      values: { ...base.values, batch_id: `0x${randomBytes(32).toString("hex")}`, commitment: `0x${randomBytes(32).toString("hex")}` },
    });
    const rogue = await generateIssuerKeyPair();
    const unknownKey = await signCredential({ ...rogue, type: "Degree", values: { ...base.values, key_id: rogue.keyId } });
    await insertForgeries([strayBatch, unknownKey].map((credential) => ({ forgedSetId: randomUUID(), issuerId: school.id, credential })));

    const full = await run("full");
    expect(full).toMatchObject({
      total: 8,
      accepted: 0,
      rejected: 8,
      by_code: { KEY_COMPROMISED_ANCHORED_IN_WINDOW: 4, BATCH_NOT_ANCHORED: 3, KEY_UNKNOWN: 1 },
    });
    const naive = await run("naive");
    expect(naive).toMatchObject({ total: 8, accepted: 7, rejected: 1, by_code: { KEY_UNKNOWN: 1 } });
    for (const r of [full, naive]) expect(sum(r.by_code)).toBe(r.rejected);

    const s = await state();
    expect(s.forged_count).toBe(8);
    expect(s.stolen_keys).toEqual([expect.objectContaining({ issuer_id: school.id, key_id: stolen.key_id })]);
    expect(s.runs.map((r: { mode: string; accepted: number }) => [r.mode, r.accepted])).toEqual([
      ["naive", 7],
      ["full", 0],
      ["naive", 4],
      ["full", 4],
    ]);

    await attack("reset").expect(200);
    expect(await state()).toEqual({ stolen_keys: [], forged_count: 0, runs: [] });
    const batches = (await request(app).get(`${api}/issuers/${school.id}/batches`).expect(200)).body.items;
    expect(batches.some((b: { batch_id: string; status: string }) => b.batch_id === forged.batch_id && b.status === "anchored")).toBe(true);
  });
});
