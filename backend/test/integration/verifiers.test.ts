// V1-H4: verifiers + presentation requests against real Postgres.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { config } from "../../src/config";
import { db, pool } from "../../src/db/client";
import { presentationRequests } from "../../src/db/schema";
import { employerPolicy } from "../policy-factory";
import { integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";

const newVerifier = async () =>
  (await request(app).post(`${api}/verifiers`).send({ name: uniqueSuffix("Employer") }).expect(201)).body as {
    id: string;
    name: string;
    did: string;
  };

const newRequest = (verifierId: string, policy = employerPolicy(uniqueSuffix("purpose"))) =>
  request(app).post(`${api}/presentation-requests`).send({ verifier_id: verifierId, policy, nl_text: null });

describe.skipIf(!integrationEnabled)("verifiers + presentation requests (integration)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("POST/GET /verifiers", async () => {
    const v = await newVerifier();
    expect(v.did).toMatch(/^did:zkred:verifier:/);
    const list = (await request(app).get(`${api}/verifiers`).expect(200)).body.items;
    expect(list).toContainEqual(expect.objectContaining({ id: v.id, name: v.name, did: v.did }));
    expect((await request(app).post(`${api}/verifiers`).send({ name: "x" }).expect(422)).body.error.details).toHaveProperty("name");
  });

  it("POST /presentation-requests: fresh nonce, TTL from config, wallet link, consent summary; GET returns it", async () => {
    const v = await newVerifier();
    const policy = employerPolicy(uniqueSuffix("purpose"));
    const before = Date.now();
    const created = (await newRequest(v.id, policy).expect(201)).body;

    expect(created).toMatchObject({ verifier_id: v.id, verifier_name: v.name, policy });
    expect(created.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const ttlMs = Date.parse(created.expires_at) - before;
    expect(ttlMs).toBeGreaterThan(config.REQUEST_TTL_SECONDS * 1000 - 5000);
    expect(ttlMs).toBeLessThanOrEqual(config.REQUEST_TTL_SECONDS * 1000 + 1000);
    const link = new URL(created.wallet_url);
    expect(link.origin).toBe(new URL(config.PUBLIC_BASE_URL).origin);
    expect(link.searchParams.get("request")).toBe(created.id);
    expect(created.consent_summary).toContain(v.name);

    expect((await request(app).get(`${api}/presentation-requests/${created.id}`).expect(200)).body).toEqual(created);

    const other = (await newRequest(v.id, policy).expect(201)).body;
    expect(other.nonce).not.toBe(created.nonce);
  });

  it("an expired request → 410 REQUEST_EXPIRED", async () => {
    const v = await newVerifier();
    const created = (await newRequest(v.id).expect(201)).body;
    await db.update(presentationRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(presentationRequests.id, created.id));
    const res = await request(app).get(`${api}/presentation-requests/${created.id}`).expect(410);
    expect(res.body.error.code).toBe("REQUEST_EXPIRED");
  });

  it("rejects unsafe or broken policies and unknown verifiers with 422", async () => {
    const v = await newVerifier();
    const leaky = employerPolicy(uniqueSuffix("p"));
    leaky.requirements[0]!.reveal.push("holder_name"); // also in never_collect
    expect((await newRequest(v.id, leaky).expect(422)).body.error.code).toBe("VALIDATION_ERROR");

    const unknownField = employerPolicy(uniqueSuffix("p"));
    unknownField.requirements[2]!.reveal = ["blood_group"];
    await newRequest(v.id, unknownField).expect(422);

    const ageOnDegree = employerPolicy(uniqueSuffix("p"));
    ageOnDegree.requirements[0]!.predicates = [{ type: "age_gte", years: 21 }];
    await newRequest(v.id, ageOnDegree).expect(422);

    expect((await newRequest(randomUUID()).expect(422)).body.error.details).toHaveProperty("verifier_id");
    await request(app).post(`${api}/presentation-requests`).send({ verifier_id: v.id }).expect(422);
  });

  it("GET verifications lists none before V1.1; unknown request → 404", async () => {
    const v = await newVerifier();
    const created = (await newRequest(v.id).expect(201)).body;
    expect((await request(app).get(`${api}/presentation-requests/${created.id}/verifications`).expect(200)).body).toEqual({ items: [] });
    await request(app).get(`${api}/presentation-requests/${randomUUID()}/verifications`).expect(404);
    await request(app).get(`${api}/presentation-requests/${randomUUID()}`).expect(404);
  });
});
