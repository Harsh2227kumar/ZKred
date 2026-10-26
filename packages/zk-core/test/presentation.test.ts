/// <reference types="node" />
// V1.1-H1: buildPresentation end to end against the committed circuit artifacts. Every piece it emits is checked
// with the same verifier-side primitives the backend engine uses.
import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import {
  PresentationSchema,
  ageCutoffDays,
  buildPresentation,
  dateToDays,
  dobCommitment,
  generateIssuerKeyPair,
  matchCredentials,
  merkleRoot,
  randomDobSalt,
  signCredential,
  verifyAgeGte,
  verifyDisclosure,
  verifyMerkleProof,
  type Hex32,
  type PresentationPolicy,
  type SignedCredential,
  type ZkArtifacts,
} from "../src";
import { base64urlToBytes, bytesToBase64url } from "../src/encoding";
import { buildValues, randomHex32, randomText } from "./factories";

const build = (f: string) => new URL(`../../../circuits/build/${f}`, import.meta.url);
const today = dateToDays("2026-10-25");
const newNonce = () => bytesToBase64url(crypto.getRandomValues(new Uint8Array(32)));

let artifacts: ZkArtifacts;
let vkey: object;
let keys: Awaited<ReturnType<typeof generateIssuerKeyPair>>;
let issuerDid: string;
let degree: SignedCredential;
let govId: SignedCredential;
let leaves: Hex32[];
let batchId: Hex32;

async function sign(type: SignedCredential["type"], extra: Record<string, string>) {
  const values = { ...buildValues(type, keys.keyId, issuerDid), batch_id: batchId, ...extra };
  return signCredential({ secretKey: keys.secretKey, publicKey: keys.publicKey, type, values });
}

const policy = (over: Partial<PresentationPolicy["requirements"][number]> = {}): PresentationPolicy => ({
  purpose: randomText("purpose"),
  never_collect: ["holder_name", "dob", "address"],
  requirements: [
    {
      id: "r1",
      credential_type: "Degree",
      accredited_only: true,
      issuer_kinds: null,
      issuer_dids: null,
      reveal: ["degree_name", "institution"],
      equals: [],
      predicates: [],
      require_not_revoked: true,
      ...over,
    },
  ],
});

const input = (p: PresentationPolicy, nonce = newNonce()) => ({
  request: { id: crypto.randomUUID(), nonce, policy: p },
  credentials: [degree, govId],
  issuerPublicKeys: { [keys.keyId]: keys.publicKey },
  batchLeaves: { [batchId]: leaves },
  todayDays: today,
  artifacts,
});

beforeAll(async () => {
  const [wasm, zkey, vk] = await Promise.all([readFile(build("age_gte.wasm")), readFile(build("age_gte.zkey")), readFile(build("vkey.json"), "utf8")]);
  vkey = JSON.parse(vk);
  artifacts = { wasm: new Uint8Array(wasm).buffer, zkey: new Uint8Array(zkey).buffer };
  keys = await generateIssuerKeyPair();
  issuerDid = randomText("did:zkred");
  batchId = randomHex32();

  const salt = randomDobSalt();
  const dob = "1999-03-14";
  degree = await sign("Degree", {});
  govId = await sign("GovernmentId", {
    dob,
    dob_salt: salt.toString(),
    dob_commitment: await dobCommitment(BigInt(dateToDays(dob)), salt),
  });
  leaves = [randomHex32(), degree.values.commitment as Hex32, randomHex32(), govId.values.commitment as Hex32, randomHex32()];
});

describe("buildPresentation", () => {
  it("discloses mandatory meta + requested fields only, bound to the nonce, with a valid Merkle proof", async () => {
    const nonce = newNonce();
    const p = await buildPresentation(input(policy(), nonce));
    expect(PresentationSchema.safeParse(p).success).toBe(true);
    const item = p.items[0]!;
    expect(item.requirement_id).toBe("r1");
    expect(Object.keys(item.disclosed).map(Number).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 10, 12]);
    expect(item.disclosed["10"]).toBe(degree.values.degree_name);
    expect(Object.values(item.disclosed)).not.toContain(degree.values.holder_name);
    expect(item.age_proof).toBeNull();

    const check = (n: string) =>
      verifyDisclosure({ publicKey: keys.publicKey, type: "Degree", disclosed: item.disclosed, bbsProof: base64urlToBytes(item.bbs_proof), nonce: base64urlToBytes(n) });
    expect(await check(nonce)).toBe(true);
    expect(await check(newNonce())).toBe(false); // replay under another request fails
    expect(verifyMerkleProof(merkleRoot(leaves), item.disclosed["6"] as Hex32, item.merkle_proof as Hex32[])).toBe(true);
  });

  it("proves age ≥ N on the signed dob_commitment without disclosing the date of birth", async () => {
    const p = await buildPresentation(
      input(policy({ credential_type: "GovernmentId", reveal: ["nationality"], predicates: [{ type: "age_gte", years: 21 }] })),
    );
    const item = p.items[0]!;
    expect(item.disclosed["13"]).toBe(govId.values.dob_commitment);
    expect(item.disclosed["10"]).toBeUndefined(); // dob
    expect(item.disclosed["12"]).toBeUndefined(); // dob_salt
    expect(item.age_proof!.public_signals).toEqual([govId.values.dob_commitment, String(ageCutoffDays(today, 21))]);
    expect(await verifyAgeGte({ proof: item.age_proof!.proof, publicSignals: item.age_proof!.public_signals, vkey })).toBe(true);
  });

  it("answers several requirements in one presentation", async () => {
    const p0 = policy();
    p0.requirements.push({ ...p0.requirements[0]!, id: "r2", credential_type: "GovernmentId", reveal: [], predicates: [{ type: "age_gte", years: 18 }] });
    const p = await buildPresentation(input(p0));
    expect(p.items.map((x) => [x.requirement_id, x.credential_type])).toEqual([["r1", "Degree"], ["r2", "GovernmentId"]]);
  });

  it("throws MISSING_CREDENTIAL when nothing matches (too young, equals, unanchored, wrong key, bad signature)", async () => {
    const missing = { code: "MISSING_CREDENTIAL" };
    await expect(buildPresentation(input(policy({ credential_type: "MedicalLicense", reveal: [] })))).rejects.toMatchObject(missing);
    await expect(
      buildPresentation(input(policy({ credential_type: "GovernmentId", reveal: [], predicates: [{ type: "age_gte", years: 90 }] }))),
    ).rejects.toMatchObject(missing);
    await expect(
      buildPresentation(input(policy({ equals: [{ field: "institution", value: randomText("other") }], reveal: ["institution"] }))),
    ).rejects.toMatchObject(missing);
    await expect(buildPresentation({ ...input(policy()), batchLeaves: { [batchId]: [randomHex32()] } })).rejects.toMatchObject(missing);
    await expect(buildPresentation({ ...input(policy()), issuerPublicKeys: {} })).rejects.toMatchObject(missing);
    const tampered = { ...degree, values: { ...degree.values, degree_name: randomText("forged") } };
    await expect(buildPresentation({ ...input(policy()), credentials: [tampered] })).rejects.toMatchObject(missing);
  });
});

describe("matchCredentials", () => {
  it("honours accredited_only, issuer_kinds and issuer_dids when issuer info is given", () => {
    const r = policy({ issuer_kinds: ["university"] }).requirements[0]!;
    const opts = (accredited: boolean, kind: "university" | "government") => ({ todayDays: today, issuers: { [issuerDid]: { accredited, kind } } });
    expect(matchCredentials(r, [degree, govId], opts(true, "university"))).toEqual([degree]);
    expect(matchCredentials(r, [degree], opts(false, "university"))).toEqual([]);
    expect(matchCredentials(r, [degree], opts(true, "government"))).toEqual([]);
    expect(matchCredentials(r, [degree], { todayDays: today, issuers: {} })).toEqual([]);
    expect(matchCredentials({ ...r, issuer_dids: [randomText("did")] }, [degree], { todayDays: today })).toEqual([]);
  });
});
