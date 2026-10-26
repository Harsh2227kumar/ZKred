// V1.2-H4: input validation everywhere. Every malformed request to every endpoint must be a 4xx with the standard
// error shape (CONTRACTS §2), never a 500, against the real Postgres + chain: values the DB can't store (NUL, unpaired
// UTF-16 surrogates, integers past int4), malformed ids, wrong body/query shapes, unknown resources.
import { randomBytes, randomUUID } from "node:crypto";
import { walletCrypto } from "@zkred/zk-core";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { pool } from "../../src/db/client";
import { employerPolicy } from "../policy-factory";
import { adminAuth, createIssuer, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";
const NUL = "\u0000";
const LONE_SURROGATE = "\uD800";
const PG_INT_OVERFLOW = 2 ** 31;
const hex32 = () => `0x${randomBytes(32).toString("hex")}`;

type Send = () => request.Test;
interface Case {
  name: string;
  send: Send;
  status?: number;
}

async function expectClientError(c: Case) {
  const res = await c.send();
  expect(res.status, `${c.name} → ${res.status} ${JSON.stringify(res.body)}`).toBeGreaterThanOrEqual(400);
  expect(res.status, `${c.name} → ${res.status} ${JSON.stringify(res.body)}`).toBeLessThan(500);
  if (c.status) expect(res.status, c.name).toBe(c.status);
  expect(res.body.error, c.name).toMatchObject({ code: expect.any(String), message: expect.any(String) });
}

describe.skipIf(!integrationEnabled)("input validation: 4xx, never 500 (integration)", () => {
  let issuerId: string;
  let wallet: { id: string; auth: { Authorization: string } };
  let verifierId: string;
  let requestId: string;
  let nonce: string;

  beforeAll(async () => {
    issuerId = (await createIssuer(app, "university")).id;
    const keys = await walletCrypto.generateWalletKeyPair();
    const w = (await request(app).post(`${api}/wallets`).send({ display_name: uniqueSuffix("holder"), enc_public_key: keys.publicKeyB64 }).expect(201)).body;
    wallet = { id: w.id, auth: { Authorization: `Bearer ${w.wallet_token}` } };
    verifierId = (await request(app).post(`${api}/verifiers`).send({ name: uniqueSuffix("Employer") }).expect(201)).body.id;
    const req = (
      await request(app)
        .post(`${api}/presentation-requests`)
        .send({ verifier_id: verifierId, policy: employerPolicy(uniqueSuffix("purpose")), nl_text: null })
        .expect(201)
    ).body;
    requestId = req.id;
    nonce = req.nonce;
  });

  afterAll(async () => {
    await pool.end();
  });

  const unstorable = [NUL, LONE_SURROGATE];

  it.each(unstorable.map((bad) => [JSON.stringify(bad), bad]))("strings Postgres can't store (%s) → 422 everywhere", async (_label, bad) => {
    const presentation = {
      request_id: requestId,
      nonce,
      items: [
        {
          requirement_id: "r1",
          credential_type: "Degree",
          issuer_did: `did:zkred:${bad}`,
          key_id: hex32(),
          disclosed: { "0": "Degree", "1": `did:zkred:${bad}`, "2": hex32() },
          bbs_proof: "AA",
          merkle_proof: [],
          age_proof: null,
        },
      ],
    };
    const cases: Case[] = [
      { name: "verifier name", send: () => request(app).post(`${api}/verifiers`).send({ name: `Acme ${bad} Ltd` }) },
      { name: "issuer name", send: () => request(app).post(`${api}/issuers`).set(adminAuth).send({ name: `Uni ${bad}`, kind: "university", did_suffix: uniqueSuffix("iss") }) },
      {
        name: "wallet display name",
        send: () => request(app).post(`${api}/wallets`).send({ display_name: `Asha ${bad}`, enc_public_key: wallet.id.replace(/-/g, "") }),
      },
      // A URL can't carry an unpaired surrogate (decoding yields U+FFFD, which is storable): any 4xx; NUL must be 422.
      { name: "wallet lookup query", status: bad === NUL ? 422 : undefined, send: () => request(app).get(`${api}/wallets/lookup`).query({ display_name: `Asha ${bad}` }) },
      {
        name: "request policy + nl_text",
        send: () =>
          request(app)
            .post(`${api}/presentation-requests`)
            .send({ verifier_id: verifierId, policy: employerPolicy(`hire ${bad}`), nl_text: `need a degree ${bad}` }),
      },
      { name: "presentation disclosed values", send: () => request(app).post(`${api}/presentation-requests/${requestId}/presentations`).send(presentation) },
      {
        name: "issued claims",
        send: () =>
          request(app)
            .post(`${api}/issuers/${issuerId}/credentials`)
            .set(adminAuth)
            .send({ credential_type: "Degree", wallet_id: wallet.id, claims: { degree_name: `MBBS ${bad}` } }),
      },
      {
        name: "forged claims",
        send: () => request(app).post(`${api}/attack/forge`).set(adminAuth).send({ issuer_id: issuerId, count: 1, claims: { degree_name: `MBBS ${bad}` } }),
      },
    ];
    for (const c of cases) await expectClientError({ status: 422, ...c });
  });

  it("integers past the DB's int4 range → 422", async () => {
    const backup = { ciphertext: "AAAA", iv: "AAAA", salt: "AAAA", kdf_iterations: 600000, version: 1 };
    for (const over of [{ kdf_iterations: PG_INT_OVERFLOW }, { version: PG_INT_OVERFLOW }]) {
      await expectClientError({
        name: `backup ${JSON.stringify(over)}`,
        status: 422,
        send: () => request(app).put(`${api}/wallets/${wallet.id}/backup`).set(wallet.auth).send({ ...backup, ...over }),
      });
    }
  });

  it("malformed bodies, queries and ids → 4xx on every endpoint", async () => {
    const cases: Case[] = [
      // bodies
      { name: "malformed JSON", status: 400, send: () => request(app).post(`${api}/verifiers`).set("Content-Type", "application/json").send('{"name":') },
      { name: "JSON array body", status: 422, send: () => request(app).post(`${api}/verifiers`).send([{ name: "Acme Ltd" }]) },
      { name: "text body", status: 422, send: () => request(app).post(`${api}/verifiers`).set("Content-Type", "text/plain").send("Acme Ltd") },
      { name: "wallet create wrong types", status: 422, send: () => request(app).post(`${api}/wallets`).send({ display_name: 42, enc_public_key: {} }) },
      { name: "issuer kind not an enum", status: 422, send: () => request(app).post(`${api}/issuers`).set(adminAuth).send({ name: "Uni", kind: "bank", did_suffix: "x-y-z" }) },
      { name: "issue unknown type", status: 422, send: () => request(app).post(`${api}/issuers/${issuerId}/credentials`).set(adminAuth).send({ credential_type: "Passport", wallet_id: wallet.id, claims: {} }) },
      { name: "issue to unknown wallet", status: 422, send: () => request(app).post(`${api}/issuers/${issuerId}/credentials`).set(adminAuth).send({ credential_type: "Degree", wallet_id: randomUUID(), claims: {} }) },
      { name: "compromise window string", status: 422, send: () => request(app).post(`${api}/issuers/${issuerId}/keys/${hex32()}/compromise`).set(adminAuth).send({ window_seconds: "48h" }) },
      { name: "request unknown verifier", status: 422, send: () => request(app).post(`${api}/presentation-requests`).send({ verifier_id: randomUUID(), policy: employerPolicy("hire"), nl_text: null }) },
      { name: "request policy reveals PII it never collects", status: 422, send: () => request(app).post(`${api}/presentation-requests`).send({ verifier_id: verifierId, policy: { ...employerPolicy("hire"), never_collect: ["degree_name"] }, nl_text: null }) },
      { name: "presentation empty", status: 422, send: () => request(app).post(`${api}/presentation-requests/${requestId}/presentations`).send({}) },
      { name: "backup missing fields", status: 422, send: () => request(app).put(`${api}/wallets/${wallet.id}/backup`).set(wallet.auth).send({ ciphertext: "AAAA" }) },
      { name: "backup not base64url", status: 422, send: () => request(app).put(`${api}/wallets/${wallet.id}/backup`).set(wallet.auth).send({ ciphertext: "a b", iv: "+/", salt: "=", kdf_iterations: 1, version: 1 }) },
      // queries
      { name: "limit repeated", status: 422, send: () => request(app).get(`${api}/issuers/${issuerId}/credentials?limit=1&limit=2`).set(adminAuth) },
      { name: "limit not a number", status: 422, send: () => request(app).get(`${api}/issuers/${issuerId}/credentials?limit=lots`).set(adminAuth) },
      { name: "cursor garbage", status: 422, send: () => request(app).get(`${api}/issuers/${issuerId}/credentials?cursor=${"%E2%98%83".repeat(5)}`).set(adminAuth) },
      { name: "lookup name repeated", status: 422, send: () => request(app).get(`${api}/wallets/lookup?display_name=Asha&display_name=Rohan`) },
      { name: "lookup missing", status: 422, send: () => request(app).get(`${api}/wallets/lookup`) },
      // ids
      { name: "issuer id not a uuid", status: 422, send: () => request(app).get(`${api}/issuers/1%20OR%201=1`) },
      { name: "batch id not hex", status: 422, send: () => request(app).get(`${api}/batches/0x1234/leaves`) },
      { name: "list id not hex", status: 422, send: () => request(app).get(`${api}/status-lists/${"zz".repeat(32)}`) },
      { name: "request id not a uuid", status: 422, send: () => request(app).get(`${api}/presentation-requests/latest`) },
      { name: "anchor batch id not hex", status: 422, send: () => request(app).post(`${api}/issuers/${issuerId}/batches/batch-1/anchor`).set(adminAuth) },
      { name: "offer id not a uuid", status: 422, send: () => request(app).post(`${api}/wallets/${wallet.id}/offers/first/claim`).set(wallet.auth) },
      // unknown resources
      { name: "unknown issuer", status: 404, send: () => request(app).get(`${api}/issuers/${randomUUID()}`) },
      { name: "unknown issuer batches", status: 404, send: () => request(app).get(`${api}/issuers/${randomUUID()}/batches`) },
      { name: "unknown issuer rotate", status: 404, send: () => request(app).post(`${api}/issuers/${randomUUID()}/keys/rotate`).set(adminAuth) },
      { name: "unknown batch leaves", status: 404, send: () => request(app).get(`${api}/batches/${hex32()}/leaves`) },
      { name: "unknown batch anchor", status: 404, send: () => request(app).post(`${api}/issuers/${issuerId}/batches/${hex32()}/anchor`).set(adminAuth) },
      { name: "unknown status list", status: 404, send: () => request(app).get(`${api}/status-lists/${hex32()}`) },
      { name: "unknown request", status: 404, send: () => request(app).get(`${api}/presentation-requests/${randomUUID()}`) },
      { name: "unknown request verifications", status: 404, send: () => request(app).get(`${api}/presentation-requests/${randomUUID()}/verifications`) },
      { name: "unknown offer", status: 404, send: () => request(app).post(`${api}/wallets/${wallet.id}/offers/${randomUUID()}/claim`).set(wallet.auth) },
      { name: "no backup yet", status: 404, send: () => request(app).get(`${api}/wallets/${wallet.id}/backup`).set(wallet.auth) },
      { name: "unknown wallet name", status: 404, send: () => request(app).get(`${api}/wallets/lookup`).query({ display_name: uniqueSuffix("nobody") }) },
      { name: "unknown route", status: 404, send: () => request(app).get(`${api}/credentials`) },
      // auth
      { name: "garbage bearer", status: 401, send: () => request(app).get(`${api}/wallets/${wallet.id}/offers`).set("Authorization", "Bearer") },
      { name: "admin token on wallet route", status: 401, send: () => request(app).get(`${api}/wallets/${wallet.id}/offers`).set(adminAuth) },
    ];
    for (const c of cases) await expectClientError(c);
  });
});
