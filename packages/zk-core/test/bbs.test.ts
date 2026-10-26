import { beforeAll, describe, expect, it } from "vitest";
import {
  CREDENTIAL_LAYOUTS,
  ZkCoreError,
  deriveDisclosure,
  encodeMessages,
  generateIssuerKeyPair,
  pubKeyHash,
  signCredential,
  verifyCredential,
  verifyDisclosure,
  type SignedCredential,
} from "../src";
import { buildValues, randomText } from "./factories";

const nonce = () => crypto.getRandomValues(new Uint8Array(32));

describe("bbs", () => {
  let keys: Awaited<ReturnType<typeof generateIssuerKeyPair>>;
  let cred: SignedCredential;

  beforeAll(async () => {
    keys = await generateIssuerKeyPair();
    cred = await signCredential({
      secretKey: keys.secretKey,
      publicKey: keys.publicKey,
      type: "GovernmentId",
      values: buildValues("GovernmentId", keys.keyId, randomText("did:zkred")),
    });
  });

  it("generates a 96-byte G2 public key with Hex32 keyId and pubKeyHash", () => {
    expect(keys.publicKey.length).toBe(96);
    expect(keys.keyId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(pubKeyHash(keys.publicKey)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(pubKeyHash(keys.publicKey)).not.toBe(keys.keyId);
  });

  it("encodes one message per layout field and rejects unknown/missing fields", () => {
    expect(encodeMessages("GovernmentId", cred.values)).toHaveLength(15);
    expect(() => encodeMessages("GovernmentId", { ...cred.values, extra: "x" })).toThrow(ZkCoreError);
    const { dob: _dob, ...missing } = cred.values;
    expect(() => encodeMessages("GovernmentId", missing)).toThrow(/missing field dob/);
  });

  it("sign → verify", async () => {
    expect(cred.key_id).toBe(keys.keyId);
    expect(await verifyCredential(cred, keys.publicKey)).toBe(true);
  });

  it("rejects a tampered credential and a wrong key", async () => {
    const tampered = { ...cred, values: { ...cred.values, nationality: randomText("nat") } };
    expect(await verifyCredential(tampered, keys.publicKey)).toBe(false);
    const other = await generateIssuerKeyPair();
    expect(await verifyCredential(cred, other.publicKey)).toBe(false);
  });

  it("derive → verify proof reveals only meta 0–6 + requested fields", async () => {
    const n = nonce();
    const { disclosed, bbsProof } = await deriveDisclosure(cred, keys.publicKey, ["nationality", "dob_commitment"], n);
    const nat = CREDENTIAL_LAYOUTS.GovernmentId.fields.find((f) => f.name === "nationality")!.index;
    expect(Object.keys(disclosed).map(Number)).toEqual([0, 1, 2, 3, 4, 5, 6, 13, nat]);
    expect(Object.values(disclosed)).not.toContain(cred.values.dob);
    expect(Object.values(disclosed)).not.toContain(cred.values.holder_name);
    expect(await verifyDisclosure({ publicKey: keys.publicKey, type: "GovernmentId", disclosed, bbsProof, nonce: n })).toBe(true);
  });

  it("proof fails on tampered disclosed value, wrong nonce, dropped meta or flipped byte", async () => {
    const n = nonce();
    const { disclosed, bbsProof } = await deriveDisclosure(cred, keys.publicKey, ["nationality"], n);
    const base = { publicKey: keys.publicKey, type: "GovernmentId" as const, bbsProof, nonce: n };
    const nat = String(CREDENTIAL_LAYOUTS.GovernmentId.fields.find((f) => f.name === "nationality")!.index);

    expect(await verifyDisclosure({ ...base, disclosed: { ...disclosed, [nat]: randomText("nat") } })).toBe(false);
    expect(await verifyDisclosure({ ...base, disclosed, nonce: nonce() })).toBe(false);
    const { "3": _batch, ...noMeta } = disclosed;
    expect(await verifyDisclosure({ ...base, disclosed: noMeta })).toBe(false);
    const flipped = bbsProof.slice();
    flipped[10] = flipped[10]! ^ 0xff;
    expect(await verifyDisclosure({ ...base, disclosed, bbsProof: flipped })).toBe(false);
    expect(await verifyDisclosure({ ...base, disclosed, type: "Degree" })).toBe(false);
  });

  it("refuses to reveal a field that is not in the layout", async () => {
    await expect(deriveDisclosure(cred, keys.publicKey, ["degree_name"], nonce())).rejects.toThrow(/not in the GovernmentId layout/);
  });
});
