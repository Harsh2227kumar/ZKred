// V1.1-H2: the verification engine, one test per step code. DB and chain reads are replaced by an in-memory "world"
// (the engine takes its sources as a parameter), so every failure mode can be produced exactly. Crypto is real.
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  buildPresentation,
  dateToDays,
  dobCommitment,
  generateIssuerKeyPair,
  merkleRoot,
  pubKeyHash,
  randomDobSalt,
  signCredential,
  statusList,
  type Hex32,
  type Presentation,
  type PresentationPolicy,
  type SignedCredential,
} from "@zkred/zk-core";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ChainError } from "../../src/integrations/chain";
import { verifyPresentation, type VerifierSources } from "../../src/core/verifier";

const hex32 = (): Hex32 => `0x${randomBytes(32).toString("hex")}`;
const artifactsDir = new URL("../../../circuits/build/", import.meta.url);
const today = dateToDays(new Date().toISOString().slice(0, 10));

let keys: Awaited<ReturnType<typeof generateIssuerKeyPair>>;
let cred: SignedCredential;
let leaves: Hex32[];
let vkey: object;
let artifacts: { wasm: ArrayBuffer; zkey: ArrayBuffer };
const did = `did:zkred:${randomUUID()}`;
const issuerChainId = hex32();
const issuerId = randomUUID();
const batchId = hex32();
const listId = hex32();
const statusIndex = 7;

/** Everything the engine can read; tests mutate it to break one check at a time. */
let world: {
  issuer: { id: string; did: string; name: string; kind: "government" | "university"; issuerChainId: string } | null;
  key: { issuerId: string; publicKey: string } | null;
  chainIssuer: { did: string; governance: string; accredited: boolean } | null;
  chainKey: { issuerChainId: Hex32; pubKeyHash: Hex32; status: string; compromisedFrom: Date | null; activeFrom: Date } | null;
  anchor: { root: Hex32; issuerChainId: Hex32; keyId: Hex32; anchoredAt: Date } | null;
  list: { bitstring: Buffer } | null;
  listHash: { issuerChainId: Hex32; listHash: Hex32; updatedAt: Date } | null;
  chainDown: boolean;
};

const chainRead = <T>(v: () => T) => async () => {
  if (world.chainDown) throw new ChainError("CHAIN_UNAVAILABLE", "test: chain down");
  return v();
};

const sources = (): VerifierSources =>
  ({
    issuerByDid: async (d: string) => (world.issuer?.did === d ? world.issuer : null),
    key: async (k: string) => (k === keys.keyId ? world.key : null),
    statusList: async (l: string) => (l === listId ? world.list : null),
    chainIssuer: chainRead(() => world.chainIssuer),
    chainKey: chainRead(() => world.chainKey),
    chainAnchor: chainRead(() => world.anchor),
    chainListHash: chainRead(() => world.listHash),
    vkey: async () => vkey,
  }) as unknown as VerifierSources;

const policy = (): PresentationPolicy => ({
  purpose: "test",
  never_collect: ["dob", "address"],
  requirements: [
    {
      id: "r1",
      credential_type: "GovernmentId",
      accredited_only: true,
      issuer_kinds: ["government"],
      issuer_dids: null,
      reveal: ["nationality"],
      equals: [{ field: "nationality", value: cred.values.nationality! }],
      predicates: [{ type: "age_gte", years: 21 }],
      require_not_revoked: true,
    },
  ],
});

let request: { id: string; nonce: string; policy: PresentationPolicy };
let presentation: Presentation;

async function present(p = policy()): Promise<void> {
  request = { id: randomUUID(), nonce: randomBytes(32).toString("base64url"), policy: p };
  presentation = await buildPresentation({
    request,
    credentials: [cred],
    issuerPublicKeys: { [keys.keyId]: keys.publicKey },
    batchLeaves: { [batchId]: leaves },
    todayDays: today,
    artifacts,
  });
}

const verify = (mode: "full" | "naive" = "full", p: Presentation = presentation) => verifyPresentation(request, p, mode, sources());
const failedCode = async (mode: "full" | "naive" = "full", p: Presentation = presentation) => {
  const out = await verify(mode, p);
  expect(out.result).toBe("rejected");
  return out.steps.find((s) => !s.ok)?.code;
};
const clone = (): Presentation => structuredClone(presentation);

beforeAll(async () => {
  const [wasm, zkey, vk] = await Promise.all([
    readFile(new URL("age_gte.wasm", artifactsDir)),
    readFile(new URL("age_gte.zkey", artifactsDir)),
    readFile(new URL("vkey.json", artifactsDir), "utf8"),
  ]);
  artifacts = { wasm: new Uint8Array(wasm).buffer, zkey: new Uint8Array(zkey).buffer };
  vkey = JSON.parse(vk);
  keys = await generateIssuerKeyPair();
  const salt = randomDobSalt();
  const dob = "1990-06-15";
  cred = await signCredential({
    secretKey: keys.secretKey,
    publicKey: keys.publicKey,
    type: "GovernmentId",
    values: {
      cred_type: "GovernmentId",
      issuer_did: did,
      key_id: keys.keyId,
      batch_id: batchId,
      status_list_id: listId,
      status_index: String(statusIndex),
      commitment: hex32(),
      issued_at: new Date().toISOString(),
      holder_binding: "",
      holder_name: randomUUID(),
      dob,
      address: randomUUID(),
      dob_salt: salt.toString(),
      dob_commitment: await dobCommitment(BigInt(dateToDays(dob)), salt),
      nationality: randomUUID(),
    },
  });
  leaves = [hex32(), cred.values.commitment as Hex32, hex32()];
});

beforeEach(async () => {
  const bits = statusList.create(1024);
  world = {
    issuer: { id: issuerId, did, name: "Test Registry", kind: "government", issuerChainId },
    key: { issuerId, publicKey: Buffer.from(keys.publicKey).toString("base64url") },
    chainIssuer: { did, governance: "0x0", accredited: true },
    chainKey: { issuerChainId, pubKeyHash: pubKeyHash(keys.publicKey), status: "active", compromisedFrom: null, activeFrom: new Date(0) },
    anchor: { root: merkleRoot(leaves), issuerChainId, keyId: keys.keyId, anchoredAt: new Date(Date.now() - 3600_000) },
    list: { bitstring: Buffer.from(bits) },
    listHash: { issuerChainId, listHash: statusList.hash(bits), updatedAt: new Date() },
    chainDown: false,
  };
  await present();
});

describe("verifyPresentation (full)", () => {
  it("accepts a valid presentation: 4 OK steps, only the requested fields revealed", async () => {
    const out = await verify();
    expect(out.result).toBe("accepted");
    expect(out.steps.map((s) => [s.step, s.code])).toEqual([
      ["issuer_signature", "OK"],
      ["zk_claim", "OK"],
      ["revocation_status", "OK"],
      ["key_epoch_anchor", "OK"],
    ]);
    expect(out.revealed.r1).toEqual({ issuer_did: did, nationality: cred.values.nationality, dob_commitment: cred.values.dob_commitment });
    expect(JSON.stringify(out)).not.toContain(cred.values.holder_name);
    expect(JSON.stringify(out)).not.toContain(cred.values.dob);
  });

  it("BBS_INVALID: proof for another nonce (replay), tampered value, or envelope ≠ signed meta", async () => {
    const replay = { ...request, nonce: randomBytes(32).toString("base64url") };
    expect((await verifyPresentation(replay, presentation, "full", sources())).steps[0]!.code).toBe("BBS_INVALID");
    const tampered = clone();
    tampered.items[0]!.disclosed["14"] = "forged";
    expect(await failedCode("full", tampered)).toBe("BBS_INVALID");
    const envelope = clone();
    envelope.items[0]!.key_id = hex32();
    expect(await failedCode("full", envelope)).toBe("BBS_INVALID");
  });

  it("ISSUER_UNKNOWN: not in the registry DB or not on-chain", async () => {
    world.issuer = null;
    expect(await failedCode()).toBe("ISSUER_UNKNOWN");
    world.issuer = { id: issuerId, did, name: "x", kind: "government", issuerChainId };
    world.chainIssuer = null;
    expect(await failedCode()).toBe("ISSUER_UNKNOWN");
  });

  it("ISSUER_NOT_ACCREDITED and ISSUER_NOT_ALLOWED", async () => {
    world.chainIssuer!.accredited = false;
    expect(await failedCode()).toBe("ISSUER_NOT_ACCREDITED");
    world.chainIssuer!.accredited = true;
    world.issuer!.kind = "university";
    expect(await failedCode()).toBe("ISSUER_NOT_ALLOWED");
  });

  it("KEY_UNKNOWN: key of another issuer, or not registered on-chain", async () => {
    world.key = { issuerId: randomUUID(), publicKey: world.key!.publicKey };
    expect(await failedCode()).toBe("KEY_UNKNOWN");
    world.key = { issuerId, publicKey: world.key.publicKey };
    world.chainKey = null;
    expect(await failedCode()).toBe("KEY_UNKNOWN");
  });

  it("PUBKEY_HASH_MISMATCH: the published key is not the one pinned on-chain", async () => {
    world.chainKey!.pubKeyHash = hex32();
    expect(await failedCode()).toBe("PUBKEY_HASH_MISMATCH");
  });

  it("POLICY_FIELD_MISSING: requested field not disclosed, or no item for a requirement", async () => {
    const p = policy();
    p.requirements[0]!.reveal = ["nationality", "dob_commitment"];
    const missing = clone();
    delete missing.items[0]!.disclosed["14"];
    expect(await failedCode("full", missing)).toBe("BBS_INVALID"); // dropping a disclosed message breaks the proof
    request = { ...request, policy: { ...p, requirements: [...p.requirements, { ...p.requirements[0]!, id: "r2" }] } };
    const out = await verify();
    expect(out.steps.find((s) => s.requirement_id === "r2")?.code).toBe("POLICY_FIELD_MISSING");
    // A presentation built for a policy that did not ask for the field.
    const narrow = policy();
    narrow.requirements[0]!.reveal = [];
    narrow.requirements[0]!.equals = [];
    await present(narrow);
    request = { ...request, policy: policy() };
    expect(await failedCode()).toBe("POLICY_FIELD_MISSING");
  });

  it("POLICY_EQUALS_FAILED", async () => {
    const p = policy();
    p.requirements[0]!.equals = [{ field: "nationality", value: "somewhere-else" }];
    request = { ...request, policy: p };
    expect(await failedCode()).toBe("POLICY_EQUALS_FAILED");
  });

  it("AGE_PROOF_INVALID: missing or forged proof", async () => {
    const none = clone();
    none.items[0]!.age_proof = null;
    expect(await failedCode("full", none)).toBe("AGE_PROOF_INVALID");
    const forged = clone();
    const proof = forged.items[0]!.age_proof!.proof as { pi_a: string[] };
    proof.pi_a = [...proof.pi_a].reverse();
    expect(await failedCode("full", forged)).toBe("AGE_PROOF_INVALID");
  });

  it("AGE_COMMITMENT_MISMATCH: proof about another commitment", async () => {
    const other = clone();
    other.items[0]!.age_proof!.public_signals[0] = "12345";
    expect(await failedCode("full", other)).toBe("AGE_COMMITMENT_MISMATCH");
  });

  it("AGE_PROOF_STALE_DATE: proof's cutoff is later than today's cutoff for that age", async () => {
    const p = policy();
    p.requirements[0]!.predicates = [{ type: "age_gte", years: 30 }];
    request = { ...request, policy: p };
    expect(await failedCode()).toBe("AGE_PROOF_STALE_DATE");
  });

  it("REVOKED", async () => {
    const bits = statusList.create(1024);
    statusList.setBit(bits, statusIndex, true);
    world.list = { bitstring: Buffer.from(bits) };
    world.listHash!.listHash = statusList.hash(bits);
    expect(await failedCode()).toBe("REVOKED");
  });

  it("REVOCATION_LIST_TAMPERED: published list ≠ on-chain hash, or list of another issuer", async () => {
    const bits = statusList.create(1024);
    statusList.setBit(bits, 1, true);
    world.list = { bitstring: Buffer.from(bits) };
    expect(await failedCode()).toBe("REVOCATION_LIST_TAMPERED");
    world.list = { bitstring: Buffer.from(statusList.create(1024)) };
    world.listHash!.issuerChainId = hex32();
    expect(await failedCode()).toBe("REVOCATION_LIST_TAMPERED");
  });

  it("BATCH_NOT_ANCHORED: never anchored, or anchored under another key", async () => {
    world.anchor = null;
    expect(await failedCode()).toBe("BATCH_NOT_ANCHORED");
    world.anchor = { root: merkleRoot(leaves), issuerChainId, keyId: hex32(), anchoredAt: new Date() };
    expect(await failedCode()).toBe("BATCH_NOT_ANCHORED");
  });

  it("MERKLE_PROOF_INVALID: commitment not in the anchored root", async () => {
    world.anchor!.root = merkleRoot([hex32(), hex32()]);
    expect(await failedCode()).toBe("MERKLE_PROOF_INVALID");
  });

  it("KEY_COMPROMISED_ANCHORED_IN_WINDOW, while a batch anchored before the cutoff stays valid", async () => {
    world.chainKey!.status = "compromised";
    world.chainKey!.compromisedFrom = new Date(world.anchor!.anchoredAt.getTime() - 1000);
    expect(await failedCode()).toBe("KEY_COMPROMISED_ANCHORED_IN_WINDOW");
    world.chainKey!.compromisedFrom = new Date(world.anchor!.anchoredAt.getTime() + 1000);
    expect((await verify()).result).toBe("accepted");
  });

  it("CHAIN_UNAVAILABLE fails closed", async () => {
    world.chainDown = true;
    expect(await failedCode()).toBe("CHAIN_UNAVAILABLE");
  });
});

describe("verifyPresentation (naive)", () => {
  it("checks the signature only: a compromised, unanchored, unaccredited credential still passes", async () => {
    world.chainIssuer!.accredited = false;
    world.anchor = null;
    world.chainDown = true;
    const out = await verify("naive");
    expect(out.result).toBe("accepted");
    expect(out.steps.map((s) => s.step)).toEqual(["issuer_signature"]);
  });
});
