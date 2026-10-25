// Verification engine (CONTRACTS §4.2 verifyPresentation). Every requirement runs the 4-step eval chain:
//   1. issuer_signature  - issuer + key known on-chain, published key matches its on-chain hash, BBS proof valid
//                           for the request nonce, issuer allowed by the policy (accredited / kind / did)
//   2. zk_claim          - requested fields disclosed, equals constraints, Groth16 age proof on the signed commitment
//   3. revocation_status - status list hash matches the on-chain hash, the credential's bit is not set
//   4. key_epoch_anchor  - batch anchored under that key, commitment ∈ anchored root, and not anchored inside a
//                           compromise window ("chain time, not claimed time")
// A requirement stops at its first failing step. Anything that can't be checked (chain down) fails closed.
// mode "naive" runs only the BBS signature check against the published key (the attack console's contrast).
import {
  CREDENTIAL_LAYOUTS,
  MANDATORY_REVEAL_MAX_INDEX,
  ageCutoffDays,
  dateToDays,
  pubKeyHash,
  revealFieldsFor,
  statusList,
  verifyAgeGte,
  verifyDisclosure,
  verifyMerkleProof,
  type Hex32,
  type Presentation,
  type PresentationItem,
  type PresentationPolicy,
  type PresentationRequirement,
} from "@zkred/zk-core";
import { config } from "../config";
import * as issuersRepo from "../db/repositories/issuers.repo";
import * as issuanceRepo from "../db/repositories/issuance.repo";
import * as chain from "../integrations/chain";
import type { Verification } from "../schemas/verifiers.schema";
import { ageVerificationKey } from "./zk-artifacts";

type Step = Verification["steps"][number];
type StepName = Step["step"];
export type VerificationMode = Verification["mode"];
export type VerificationOutcome = Pick<Verification, "mode" | "result" | "steps" | "revealed">;

/** A failed check: becomes one failed step with this code. */
class StepFailure extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}
const fail = (code: string, message: string): never => {
  throw new StepFailure(code, message);
};

// ---------------------------------------------------------------- sources (memoised per verification run)

/**
 * Everything the engine reads from the DB and the chain, memoised so one run (e.g. 1000 forgeries in the attack
 * console) asks the chain once per issuer / key / list / batch. Create one per run; never share across runs.
 */
export function createSources() {
  const memo = new Map<string, Promise<unknown>>();
  const once = <T>(key: string, load: () => Promise<T>): Promise<T> => {
    let p = memo.get(key) as Promise<T> | undefined;
    if (!p) {
      p = load();
      memo.set(key, p);
    }
    return p;
  };
  return {
    issuerByDid: (did: string) => once(`issuer:${did}`, () => issuersRepo.findIssuerByDid(did)),
    key: (keyId: string) => once(`key:${keyId}`, () => issuersRepo.findKey(keyId)),
    statusList: (listId: string) => once(`list:${listId}`, () => issuanceRepo.findStatusList(listId)),
    chainIssuer: (id: Hex32) => once(`c-issuer:${id}`, () => chain.getIssuer(id)),
    chainKey: (keyId: Hex32) => once(`c-key:${keyId}`, () => chain.getKey(keyId)),
    chainAnchor: (batchId: Hex32) => once(`c-anchor:${batchId}`, () => chain.getAnchor(batchId)),
    chainListHash: (listId: Hex32) => once(`c-list:${listId}`, () => chain.getListHash(listId)),
    vkey: () => once("vkey", ageVerificationKey),
  };
}
export type VerifierSources = ReturnType<typeof createSources>;

// ---------------------------------------------------------------- helpers

const HEX32_RE = /^0x[0-9a-fA-F]{64}$/;
const sameHex = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

function fieldIndex(r: PresentationRequirement, name: string): number | undefined {
  return CREDENTIAL_LAYOUTS[r.credential_type].fields.find((f) => f.name === name)?.index;
}

/** Value of a signed meta field (indices 0–6) from the disclosure; meta fields are always present after step 1. */
const meta = (item: PresentationItem, index: number): string => item.disclosed[String(index)] ?? "";

function minAgeYears(r: PresentationRequirement): number | null {
  const years = r.predicates.filter((p) => p.type === "age_gte").map((p) => p.years);
  return years.length ? Math.max(...years) : null;
}

const todayDays = (): number => dateToDays(new Date().toISOString().slice(0, 10));

// ---------------------------------------------------------------- steps

interface Ctx {
  r: PresentationRequirement;
  item: PresentationItem;
  nonce: Uint8Array;
  src: VerifierSources;
  /** Filled by step 1 for the later steps. */
  issuerChainId?: Hex32;
  keyId?: Hex32;
}

async function checkSignature(ctx: Ctx, naive: boolean): Promise<string> {
  const { r, item, src } = ctx;
  if (item.credential_type !== r.credential_type) {
    fail("POLICY_FIELD_MISSING", `Expected a ${r.credential_type} credential, got ${item.credential_type}`);
  }
  // Signed meta must agree with the item's envelope, so nothing outside the signature can steer the checks.
  const [type, did, keyId] = [meta(item, 0), meta(item, 1), meta(item, 2)];
  if (type !== item.credential_type || did !== item.issuer_did || keyId !== item.key_id || !HEX32_RE.test(keyId)) {
    fail("BBS_INVALID", "The presentation's issuer / key do not match its signed values");
  }

  const issuer = await src.issuerByDid(did);
  if (!issuer) fail("ISSUER_UNKNOWN", `Issuer ${did} is not registered`);
  const key = await src.key(keyId);
  if (!key || key.issuerId !== issuer!.id) fail("KEY_UNKNOWN", "The signing key is not one of this issuer's keys");
  const publicKey = new Uint8Array(Buffer.from(key!.publicKey, "base64url"));

  if (!naive) {
    const onchainIssuer = await src.chainIssuer(issuer!.issuerChainId as Hex32);
    if (!onchainIssuer || onchainIssuer.did !== did) fail("ISSUER_UNKNOWN", `Issuer ${did} is not registered on-chain`);
    const onchainKey = await src.chainKey(keyId as Hex32);
    if (!onchainKey || !sameHex(onchainKey.issuerChainId, issuer!.issuerChainId)) {
      fail("KEY_UNKNOWN", "The signing key is not registered on-chain for this issuer");
    }
    if (!sameHex(onchainKey!.pubKeyHash, pubKeyHash(publicKey))) {
      fail("PUBKEY_HASH_MISMATCH", "The published public key does not match the hash pinned on-chain");
    }
    if (r.issuer_dids && !r.issuer_dids.includes(did)) fail("ISSUER_NOT_ALLOWED", "This issuer is not on the verifier's list");
    if (r.issuer_kinds && !r.issuer_kinds.includes(issuer!.kind)) {
      fail("ISSUER_NOT_ALLOWED", `Issuer kind ${issuer!.kind} is not accepted for this requirement`);
    }
    if (r.accredited_only && !onchainIssuer!.accredited) fail("ISSUER_NOT_ACCREDITED", "The issuer is not accredited on-chain");
  }

  const ok = await verifyDisclosure({
    publicKey,
    type: r.credential_type,
    disclosed: item.disclosed,
    bbsProof: new Uint8Array(Buffer.from(item.bbs_proof, "base64url")),
    nonce: ctx.nonce,
  });
  if (!ok) fail("BBS_INVALID", "The BBS signature proof is invalid for this request");

  ctx.issuerChainId = issuer!.issuerChainId as Hex32;
  ctx.keyId = keyId as Hex32;
  return naive ? "BBS signature valid under the published issuer key" : `Signed by ${issuer!.name} with a registered key`;
}

async function checkClaims(ctx: Ctx): Promise<string> {
  const { r, item } = ctx;
  for (const name of r.reveal) {
    if (item.disclosed[String(fieldIndex(r, name))] === undefined) fail("POLICY_FIELD_MISSING", `Field ${name} was not disclosed`);
  }
  for (const e of r.equals) {
    if (item.disclosed[String(fieldIndex(r, e.field))] !== e.value) fail("POLICY_EQUALS_FAILED", `${e.field} does not equal the required value`);
  }

  const years = minAgeYears(r);
  if (years === null) return r.equals.length ? "Requested fields disclosed and match" : "Requested fields disclosed";

  const proof = item.age_proof;
  if (!proof) fail("AGE_PROOF_INVALID", `An age ≥ ${years} proof is required`);
  const commitment = item.disclosed[String(fieldIndex(r, "dob_commitment"))];
  if (!commitment || proof!.public_signals[0] !== commitment) {
    fail("AGE_COMMITMENT_MISMATCH", "The age proof is not about the signed date-of-birth commitment");
  }
  const cutoff = Number(proof!.public_signals[1]);
  if (!(cutoff <= ageCutoffDays(todayDays(), years) + config.AGE_PROOF_MAX_SKEW_DAYS)) {
    fail("AGE_PROOF_STALE_DATE", `The age proof does not show age ≥ ${years} as of today`);
  }
  const valid = await verifyAgeGte({ proof: proof!.proof, publicSignals: proof!.public_signals, vkey: await ctx.src.vkey() });
  if (!valid) fail("AGE_PROOF_INVALID", "The zero-knowledge age proof is invalid");
  return `Proved age ≥ ${years} without revealing the date of birth`;
}

async function checkRevocation(ctx: Ctx): Promise<string> {
  const { r, item, src } = ctx;
  if (!r.require_not_revoked) return "Not required by this policy";
  const listId = meta(item, 4);
  const index = Number(meta(item, 5));
  if (!HEX32_RE.test(listId) || !/^(0|[1-9]\d*)$/.test(meta(item, 5))) fail("REVOCATION_LIST_TAMPERED", "Malformed status reference");

  const onchain = await src.chainListHash(listId as Hex32);
  if (!onchain || !sameHex(onchain.issuerChainId, ctx.issuerChainId!)) {
    fail("REVOCATION_LIST_TAMPERED", "The status list is not registered on-chain for this issuer");
  }
  const list = await src.statusList(listId);
  if (!list) fail("REVOCATION_LIST_TAMPERED", "The status list is not published");
  const bits = new Uint8Array(list!.bitstring);
  if (!sameHex(statusList.hash(bits), onchain!.listHash)) {
    fail("REVOCATION_LIST_TAMPERED", "The published status list does not match its on-chain hash");
  }
  if (index >= bits.length * 8) fail("REVOCATION_LIST_TAMPERED", "Status index is outside the list");
  if (statusList.getBit(bits, index)) fail("REVOKED", "The issuer has revoked this credential");
  return "Not revoked (list hash matches the chain)";
}

async function checkAnchor(ctx: Ctx): Promise<string> {
  const { item, src } = ctx;
  const batchId = meta(item, 3);
  const commitment = meta(item, 6);
  if (!HEX32_RE.test(batchId) || !HEX32_RE.test(commitment)) fail("MERKLE_PROOF_INVALID", "Malformed batch reference");

  const anchor = await src.chainAnchor(batchId as Hex32);
  if (!anchor) fail("BATCH_NOT_ANCHORED", "The credential's batch was never anchored on-chain");
  if (!sameHex(anchor!.issuerChainId, ctx.issuerChainId!) || !sameHex(anchor!.keyId, ctx.keyId!)) {
    fail("BATCH_NOT_ANCHORED", "The batch was anchored by a different issuer or key");
  }
  if (!verifyMerkleProof(anchor!.root, commitment as Hex32, item.merkle_proof as Hex32[])) {
    fail("MERKLE_PROOF_INVALID", "The credential is not in the anchored batch");
  }
  const key = await src.chainKey(ctx.keyId!);
  if (!key) fail("KEY_UNKNOWN", "The signing key is not registered on-chain");
  if (key!.status === "compromised" && key!.compromisedFrom && anchor!.anchoredAt.getTime() >= key!.compromisedFrom.getTime()) {
    fail(
      "KEY_COMPROMISED_ANCHORED_IN_WINDOW",
      `Anchored ${anchor!.anchoredAt.toISOString()}, after the key's compromise cutoff ${key!.compromisedFrom.toISOString()}`,
    );
  }
  const note = key!.status === "compromised" ? " (before the compromise cutoff)" : "";
  return `Anchored on-chain ${anchor!.anchoredAt.toISOString()}${note}`;
}

async function runStep(requirementId: string, step: StepName, check: () => Promise<string>): Promise<Step> {
  try {
    return { requirement_id: requirementId, step, ok: true, code: "OK", message: await check() };
  } catch (err) {
    if (err instanceof StepFailure) return { requirement_id: requirementId, step, ok: false, code: err.code, message: err.message };
    if (err instanceof chain.ChainError) {
      return { requirement_id: requirementId, step, ok: false, code: "CHAIN_UNAVAILABLE", message: "The chain could not be read; failing closed" };
    }
    throw err;
  }
}

/** The fields shown to the verifier: the policy's reveal list (by name), plus the issuer DID. */
function revealedFields(r: PresentationRequirement, item: PresentationItem): Record<string, string> {
  const out: Record<string, string> = { issuer_did: meta(item, 1) };
  for (const name of revealFieldsFor(r)) {
    const idx = fieldIndex(r, name);
    const v = idx === undefined ? undefined : item.disclosed[String(idx)];
    if (v !== undefined && idx! > MANDATORY_REVEAL_MAX_INDEX) out[name] = v;
  }
  return out;
}

/**
 * Verifies `p` against `request`. Never trusts p.nonce: the BBS proofs are checked against the request's own nonce.
 * Pass `sources` to share memoised reads across many verifications of one run.
 */
export async function verifyPresentation(
  request: { nonce: string; policy: PresentationPolicy },
  p: Presentation,
  mode: VerificationMode,
  sources: VerifierSources = createSources(),
): Promise<VerificationOutcome> {
  const nonce = new Uint8Array(Buffer.from(request.nonce, "base64url"));
  const steps: Step[] = [];
  const revealed: Verification["revealed"] = {};
  let accepted = true;

  for (const r of request.policy.requirements) {
    const item = p.items.find((x) => x.requirement_id === r.id);
    if (!item) {
      steps.push({ requirement_id: r.id, step: "issuer_signature", ok: false, code: "POLICY_FIELD_MISSING", message: "No credential was presented" });
      accepted = false;
      continue;
    }
    const ctx: Ctx = { r, item, nonce, src: sources };
    const chainSteps: [StepName, () => Promise<string>][] =
      mode === "naive"
        ? [["issuer_signature", () => checkSignature(ctx, true)]]
        : [
            ["issuer_signature", () => checkSignature(ctx, false)],
            ["zk_claim", () => checkClaims(ctx)],
            ["revocation_status", () => checkRevocation(ctx)],
            ["key_epoch_anchor", () => checkAnchor(ctx)],
          ];
    for (const [name, check] of chainSteps) {
      const s = await runStep(r.id, name, check);
      steps.push(s);
      if (!s.ok) {
        accepted = false;
        break;
      }
      if (name === "issuer_signature") revealed[r.id] = revealedFields(r, item);
    }
  }
  return { mode, result: accepted ? "accepted" : "rejected", steps, revealed };
}
