// V1.1-H2 + V1.2: the whole loop against real Postgres + a local chain. A holder wallet claims real offers, builds
// presentations with zk-core exactly like the browser does, and the API verifies them; then revocation, the breach
// scenario (steal key → forge → report compromise) and re-issue.
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  CREDENTIAL_LAYOUTS,
  buildPresentation,
  dateToDays,
  walletCrypto,
  type CredentialType,
  type Hex32,
  type PresentationPolicy,
  type SignedCredential,
} from "@zkred/zk-core";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app";
import { pool } from "../../src/db/client";
import { provider } from "../../src/integrations/chain";
import { adminAuth, createIssuer, integrationEnabled, uniqueSuffix } from "./env";

const app = createApp();
const api = "/api/v1";
const today = dateToDays(new Date().toISOString().slice(0, 10));
let artifacts: { wasm: ArrayBuffer; zkey: ArrayBuffer };

type Issuer = Awaited<ReturnType<typeof createIssuer>>;
type Jwk = Awaited<ReturnType<typeof walletCrypto.generateWalletKeyPair>>["privateKeyJwk"];
interface Holder {
  id: string;
  token: string;
  privateKeyJwk: Jwk;
}

async function newHolder(): Promise<Holder> {
  const keys = await walletCrypto.generateWalletKeyPair();
  const res = await request(app)
    .post(`${api}/wallets`)
    .send({ display_name: uniqueSuffix("holder"), enc_public_key: keys.publicKeyB64 })
    .expect(201);
  return { id: res.body.id, token: res.body.wallet_token, privateKeyJwk: keys.privateKeyJwk };
}

function claimsFor(type: CredentialType, over: Record<string, string | number> = {}): Record<string, string | number> {
  const claims: Record<string, string | number> = {};
  for (const f of CREDENTIAL_LAYOUTS[type].fields.filter((x) => x.source === "claim")) {
    if (f.kind === "date") claims[f.name] = "1994-02-11";
    else if (f.kind === "int") claims[f.name] = 2016;
    else claims[f.name] = uniqueSuffix(f.name);
  }
  return { ...claims, ...over };
}

async function issue(issuer: Issuer, holder: Holder, type: CredentialType, claims = claimsFor(type)) {
  return (
    await request(app)
      .post(`${api}/issuers/${issuer.id}/credentials`)
      .set(adminAuth)
      .send({ credential_type: type, wallet_id: holder.id, claims })
      .expect(201)
  ).body as { credential_id: string; offer_id: string; batch_id: Hex32 };
}

const anchor = async (issuer: Issuer, batchId: string) =>
  (await request(app).post(`${api}/issuers/${issuer.id}/batches/${batchId}/anchor`).set(adminAuth).expect(200)).body;

/** Claims an offer the way the wallet does: list (wallet token) → decrypt locally → claim. */
async function receive(holder: Holder, offerId: string): Promise<SignedCredential> {
  const offers = (await request(app).get(`${api}/wallets/${holder.id}/offers`).set({ Authorization: `Bearer ${holder.token}` }).expect(200)).body
    .items as { id: string; ephemeral_public_key: string; iv: string; ciphertext: string }[];
  const offer = offers.find((o) => o.id === offerId)!;
  const cred = await walletCrypto.decryptOffer(holder.privateKeyJwk, offer);
  await request(app).post(`${api}/wallets/${holder.id}/offers/${offerId}/claim`).set({ Authorization: `Bearer ${holder.token}` }).expect(200);
  return cred;
}

let verifierId: string;

const degreePolicy = (issuerDid?: string): PresentationPolicy => ({
  purpose: uniqueSuffix("hiring"),
  never_collect: ["holder_name", "grade"],
  requirements: [
    {
      id: "r1",
      credential_type: "Degree",
      accredited_only: true,
      issuer_kinds: ["university"],
      issuer_dids: issuerDid ? [issuerDid] : null,
      reveal: ["degree_name", "institution"],
      equals: [],
      predicates: [],
      require_not_revoked: true,
    },
  ],
});

async function openRequest(policy: PresentationPolicy) {
  return (await request(app).post(`${api}/presentation-requests`).send({ verifier_id: verifierId, policy, nl_text: null }).expect(201)).body as {
    id: string;
    nonce: string;
    policy: PresentationPolicy;
  };
}

/** Builds the presentation in "the wallet" from public data only (issuer keys + batch leaves from the API). */
async function present(req: { id: string; nonce: string; policy: PresentationPolicy }, creds: SignedCredential[]) {
  const issuers = (await request(app).get(`${api}/issuers`).expect(200)).body.items as { keys: { key_id: Hex32; public_key: string }[] }[];
  const issuerPublicKeys: Record<Hex32, Uint8Array> = {};
  for (const i of issuers) for (const k of i.keys) issuerPublicKeys[k.key_id] = new Uint8Array(Buffer.from(k.public_key, "base64url"));
  const batchLeaves: Record<Hex32, Hex32[]> = {};
  for (const c of creds) {
    const b = (await request(app).get(`${api}/batches/${c.values.batch_id}/leaves`).expect(200)).body;
    batchLeaves[b.batch_id as Hex32] = b.leaves;
  }
  return buildPresentation({ request: req, credentials: creds, issuerPublicKeys, batchLeaves, todayDays: today, artifacts });
}

const submit = (requestId: string, body: object) => request(app).post(`${api}/presentation-requests/${requestId}/presentations`).send(body);

async function verifyOnce(policy: PresentationPolicy, creds: SignedCredential[]) {
  const req = await openRequest(policy);
  return (await submit(req.id, await present(req, creds)).expect(200)).body as {
    result: string;
    steps: { step: string; code: string; ok: boolean }[];
    revealed: Record<string, Record<string, string>>;
  };
}
const firstFailure = (v: { steps: { ok: boolean; code: string }[] }) => v.steps.find((s) => !s.ok)?.code;

/** Hardhat only: moves chain time forward so anchors can fall before / after a compromise cutoff. */
async function advanceChain(seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

describe.skipIf(!integrationEnabled)("presentations, revocation, breach (integration)", () => {
  let uni: Issuer;
  let gov: Issuer;
  let holder: Holder;

  beforeAll(async () => {
    const dir = new URL("../../../circuits/build/", import.meta.url);
    const [wasm, zkey] = await Promise.all([readFile(new URL("age_gte.wasm", dir)), readFile(new URL("age_gte.zkey", dir))]);
    artifacts = { wasm: new Uint8Array(wasm).buffer, zkey: new Uint8Array(zkey).buffer };
    uni = await createIssuer(app, "university");
    gov = await createIssuer(app, "government");
    holder = await newHolder();
    verifierId = (await request(app).post(`${api}/verifiers`).send({ name: uniqueSuffix("Employer") }).expect(201)).body.id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it("degree + age ≥ 21: accepted with 4 OK steps per requirement; replay → 409 NONCE_USED", async () => {
    const d = await issue(uni, holder, "Degree");
    const g = await issue(gov, holder, "GovernmentId", claimsFor("GovernmentId", { dob: "1995-05-05" }));
    await anchor(uni, d.batch_id);
    await anchor(gov, g.batch_id);
    const creds = [await receive(holder, d.offer_id), await receive(holder, g.offer_id)];

    const policy = degreePolicy(uni.did);
    policy.never_collect.push("dob", "address");
    policy.requirements.push({
      id: "r2",
      credential_type: "GovernmentId",
      accredited_only: true,
      issuer_kinds: null,
      issuer_dids: null,
      reveal: [],
      equals: [],
      predicates: [{ type: "age_gte", years: 21 }],
      require_not_revoked: true,
    });
    const req = await openRequest(policy);
    const p = await present(req, creds);
    const v = (await submit(req.id, p).expect(200)).body;
    expect(v.result).toBe("accepted");
    expect(v.steps).toHaveLength(8);
    expect(v.steps.every((s: { code: string }) => s.code === "OK")).toBe(true);
    expect(v.revealed.r1).toEqual({ issuer_did: uni.did, degree_name: creds[0]!.values.degree_name, institution: creds[0]!.values.institution });
    expect(JSON.stringify(v)).not.toContain(creds[1]!.values.dob);

    expect((await submit(req.id, p).expect(409)).body.error.code).toBe("NONCE_USED");
    const list = (await request(app).get(`${api}/presentation-requests/${req.id}/verifications`).expect(200)).body.items;
    expect(list).toHaveLength(1);
  });

  it("a rejection is a 200 and does not consume the nonce; wrong request id → 422", async () => {
    const d = await issue(uni, holder, "Degree");
    const cred = await receive(holder, d.offer_id); // batch still open: never anchored
    const req = await openRequest(degreePolicy());
    const p = await buildPresentation({
      request: req,
      credentials: [cred],
      issuerPublicKeys: { [cred.key_id]: new Uint8Array(Buffer.from(uni.keys[0]!.public_key, "base64url")) },
      batchLeaves: { [d.batch_id]: (await request(app).get(`${api}/batches/${d.batch_id}/leaves`)).body.leaves },
      todayDays: today,
      artifacts,
    });
    const v = (await submit(req.id, p).expect(200)).body;
    expect(firstFailure(v)).toBe("BATCH_NOT_ANCHORED");

    await anchor(uni, d.batch_id);
    expect((await submit(req.id, p).expect(200)).body.result).toBe("accepted");
    await submit(randomUUID(), p).expect(422);
  });

  it("revocation: revoke → REVOKED (status list hash re-pinned on-chain); revoking twice → 409", async () => {
    const d = await issue(uni, holder, "Degree");
    await anchor(uni, d.batch_id);
    const cred = await receive(holder, d.offer_id);
    expect((await verifyOnce(degreePolicy(), [cred])).result).toBe("accepted");

    const out = (await request(app).post(`${api}/issuers/${uni.id}/credentials/${d.credential_id}/revoke`).set(adminAuth).expect(200)).body;
    const list = (await request(app).get(`${api}/status-lists/${out.status_list_id}`).expect(200)).body;
    expect(list.hash).toBe(out.list_hash);
    expect(list.onchain_hash.toLowerCase()).toBe(out.list_hash.toLowerCase());
    expect(firstFailure(await verifyOnce(degreePolicy(), [cred]))).toBe("REVOKED");
    await request(app).post(`${api}/issuers/${uni.id}/credentials/${d.credential_id}/revoke`).set(adminAuth).expect(409);
  });

  it("breach: forged ✓ before the report, ✗ after (naive still ✓); legacy ✓; in-window honest cred re-issued ✓", async () => {
    const auth = { Authorization: `Bearer ${holder.token}` };
    const school = await createIssuer(app, "university");
    await request(app).post(`${api}/attack/reset`).set(adminAuth).expect(200);

    // Legacy credential, anchored long before the breach.
    const legacy = await issue(school, holder, "Degree");
    await anchor(school, legacy.batch_id);
    const legacyCred = await receive(holder, legacy.offer_id);
    await advanceChain(3600);

    // The attacker copies the signing key and pushes forgeries through the pipeline (anchored now).
    const stolen = (await request(app).post(`${api}/attack/steal-key`).set(adminAuth).send({ issuer_id: school.id }).expect(200)).body;
    expect(stolen.key_id).toBe(school.keys[0]!.key_id);
    const forged = (
      await request(app)
        .post(`${api}/attack/forge`)
        .set(adminAuth)
        .send({ issuer_id: school.id, count: 3, claims: claimsFor("Degree") })
        .expect(200)
    ).body;
    expect(forged.forged_count).toBe(3);
    expect(forged.anchor_tx_hash).toMatch(/^0x/);

    // An honest holder issued during the same window.
    const inWindow = await issue(school, holder, "Degree");
    await anchor(school, inWindow.batch_id);
    const inWindowCred = await receive(holder, inWindow.offer_id);

    const before = (await request(app).post(`${api}/attack/verify-forged`).set(adminAuth).send({ mode: "full" }).expect(200)).body;
    expect(before).toMatchObject({ total: 3, accepted: 3, rejected: 0 });

    // Report: window 600 s → legacy (1 h old) stays valid, everything since is suspect.
    const report = (
      await request(app).post(`${api}/issuers/${school.id}/keys/${stolen.key_id}/compromise`).set(adminAuth).send({ window_seconds: 600 }).expect(200)
    ).body;
    expect(report.new_key.status).toBe("active");
    expect(report.new_key.key_id).not.toBe(stolen.key_id);
    const verdicts = Object.fromEntries(report.affected_batches.map((b: { batch_id: string; verdict: string }) => [b.batch_id, b.verdict]));
    expect(verdicts[legacy.batch_id]).toBe("legacy_valid");
    expect(verdicts[forged.batch_id]).toBe("in_window_needs_reissue");
    expect(verdicts[inWindow.batch_id]).toBe("in_window_needs_reissue");

    const full = (await request(app).post(`${api}/attack/verify-forged`).set(adminAuth).send({ mode: "full" }).expect(200)).body;
    expect(full).toMatchObject({ total: 3, accepted: 0, rejected: 3, by_code: { KEY_COMPROMISED_ANCHORED_IN_WINDOW: 3 } });
    const naive = (await request(app).post(`${api}/attack/verify-forged`).set(adminAuth).send({ mode: "naive" }).expect(200)).body;
    expect(naive).toMatchObject({ total: 3, accepted: 3 });
    const state = (await request(app).get(`${api}/attack/state`).set(adminAuth).expect(200)).body;
    expect(state.forged_count).toBe(3);
    expect(state.runs).toHaveLength(3);

    expect((await verifyOnce(degreePolicy(), [legacyCred])).result).toBe("accepted");
    expect(firstFailure(await verifyOnce(degreePolicy(), [inWindowCred]))).toBe("KEY_COMPROMISED_ANCHORED_IN_WINDOW");

    // Re-issue: the honest holder gets a fresh credential under the new key; forgeries can't be laundered.
    const re = (
      await request(app).post(`${api}/issuers/${school.id}/reissue`).set(auth).send({ wallet_id: holder.id, old_credential: inWindowCred }).expect(201)
    ).body;
    const fresh = await receive(holder, re.offer_id);
    expect(fresh.key_id).toBe(report.new_key.key_id);
    expect(fresh.values.degree_name).toBe(inWindowCred.values.degree_name);
    await anchor(school, fresh.values.batch_id!);
    expect((await verifyOnce(degreePolicy(), [fresh])).result).toBe("accepted");

    await request(app).post(`${api}/issuers/${school.id}/reissue`).set(auth).send({ wallet_id: holder.id, old_credential: inWindowCred }).expect(409);
    const forgedCred = { ...inWindowCred, values: { ...inWindowCred.values, commitment: `0x${"11".repeat(32)}` } };
    await request(app).post(`${api}/issuers/${school.id}/reissue`).set(auth).send({ wallet_id: holder.id, old_credential: forgedCred }).expect(403);
    const other = await newHolder();
    await request(app)
      .post(`${api}/issuers/${school.id}/reissue`)
      .set(auth)
      .send({ wallet_id: other.id, old_credential: legacyCred })
      .expect(403);

    // Forging after the report: the stolen key can no longer anchor.
    const late = (
      await request(app).post(`${api}/attack/forge`).set(adminAuth).send({ issuer_id: school.id, count: 1, claims: claimsFor("Degree") }).expect(200)
    ).body;
    expect(late.anchor_tx_hash).toBeNull();
    await request(app).post(`${api}/attack/reset`).set(adminAuth).expect(200);
  });
});
