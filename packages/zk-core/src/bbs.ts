// BBS signatures over the frozen credential layouts. The ONLY file that imports @digitalbazaar/bbs-signatures.
// Ciphersuite: BLS12-381-SHA-256 (IETF draft-irtf-cfrg-bbs-signatures). Header binds credential type + layout version;
// presentation header = the verifier's nonce.
import * as bbs from "@digitalbazaar/bbs-signatures";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { concatBytes } from "@noble/hashes/utils.js";
import { base64urlToBytes, bytesToBase64url, bytesToHex32, bytesToUtf8, utf8ToBytes } from "./encoding";
import { ZkCoreError } from "./errors";
import { CREDENTIAL_LAYOUTS, CREDENTIAL_TYPES, MANDATORY_REVEAL_MAX_INDEX, type CredentialType } from "./layouts";
import type { Hex32, SignedCredential } from "./types";

const CIPHERSUITE = bbs.CIPHERSUITES.BLS12381_SHA256;
const KEY_ID_DOMAIN = utf8ToBytes("zkred:key_id:v1");
const HEX32_RE = /^0x[0-9a-fA-F]{64}$/;

function layoutOf(type: CredentialType) {
  const layout = CREDENTIAL_LAYOUTS[type];
  if (!layout) throw new ZkCoreError("UNKNOWN_CREDENTIAL_TYPE", `unknown credential type: ${String(type)}`);
  return layout;
}

function headerFor(type: CredentialType): Uint8Array {
  return utf8ToBytes(`zkred:${type}:v${layoutOf(type).version}`);
}

/** Indices that are always disclosed (CONTRACTS §4.1: meta 0–6). */
function mandatoryIndices(): number[] {
  return Array.from({ length: MANDATORY_REVEAL_MAX_INDEX + 1 }, (_, i) => i);
}

export async function generateIssuerKeyPair(): Promise<{ publicKey: Uint8Array; secretKey: Uint8Array; keyId: Hex32 }> {
  const { publicKey, secretKey } = await bbs.generateKeyPair({ ciphersuite: CIPHERSUITE });
  // keyId is derived from the public key (domain-separated from pubKeyHash) so it is unique and reproducible.
  const keyId = bytesToHex32(keccak_256(concatBytes(KEY_ID_DOMAIN, publicKey)));
  return { publicKey, secretKey, keyId };
}

/** keccak256 of the raw BBS public key; this is what IssuerRegistry stores on-chain. */
export function pubKeyHash(publicKey: Uint8Array): Hex32 {
  return bytesToHex32(keccak_256(publicKey));
}

/** One UTF-8 message per layout field, in index order. Every field must be present (empty string allowed). */
export function encodeMessages(type: CredentialType, values: Record<string, string>): Uint8Array[] {
  const fields = layoutOf(type).fields;
  const known = new Set(fields.map((f) => f.name));
  const unknown = Object.keys(values).filter((k) => !known.has(k));
  if (unknown.length) throw new ZkCoreError("INVALID_VALUES", `unknown fields for ${type}: ${unknown.join(", ")}`);
  return [...fields]
    .sort((a, b) => a.index - b.index)
    .map((f) => {
      const v = values[f.name];
      if (typeof v !== "string") throw new ZkCoreError("INVALID_VALUES", `missing field ${f.name} for ${type}`);
      return utf8ToBytes(v);
    });
}

export async function signCredential(i: {
  secretKey: Uint8Array;
  publicKey: Uint8Array;
  type: CredentialType;
  values: Record<string, string>;
}): Promise<SignedCredential> {
  const { type, values } = i;
  if (values.cred_type !== type) throw new ZkCoreError("INVALID_VALUES", `cred_type must equal ${type}`);
  const keyId = values.key_id ?? "";
  if (!HEX32_RE.test(keyId)) throw new ZkCoreError("INVALID_VALUES", "key_id must be a 0x-prefixed 32-byte hex string");
  const messages = encodeMessages(type, values);
  const signature = await bbs.sign({
    secretKey: i.secretKey,
    publicKey: i.publicKey,
    header: headerFor(type),
    messages,
    ciphersuite: CIPHERSUITE,
  });
  return {
    type,
    issuer_did: values.issuer_did ?? "",
    key_id: keyId as Hex32,
    values: { ...values },
    signature: bytesToBase64url(signature),
  };
}

/** Fails closed: any malformed input returns false instead of throwing. */
export async function verifyCredential(c: SignedCredential, publicKey: Uint8Array): Promise<boolean> {
  try {
    if (!CREDENTIAL_TYPES.includes(c.type)) return false;
    if (c.values.cred_type !== c.type || c.values.issuer_did !== c.issuer_did || c.values.key_id !== c.key_id) return false;
    return await bbs.verifySignature({
      publicKey,
      signature: base64urlToBytes(c.signature),
      header: headerFor(c.type),
      messages: encodeMessages(c.type, c.values),
      ciphersuite: CIPHERSUITE,
    });
  } catch {
    return false;
  }
}

/**
 * Selective disclosure: reveals meta 0–6 plus `revealFields`, keyed by message index (as in Presentation.disclosed).
 * `nonce` is bound as the BBS presentation header.
 */
export async function deriveDisclosure(
  c: SignedCredential,
  publicKey: Uint8Array,
  revealFields: string[],
  nonce: Uint8Array,
): Promise<{ disclosed: Record<string, string>; bbsProof: Uint8Array }> {
  const fields = layoutOf(c.type).fields;
  const indices = new Set(mandatoryIndices());
  for (const name of revealFields) {
    const f = fields.find((x) => x.name === name);
    if (!f) throw new ZkCoreError("UNKNOWN_FIELD", `field ${name} is not in the ${c.type} layout`);
    indices.add(f.index);
  }
  const disclosedMessageIndexes = [...indices].sort((a, b) => a - b);
  const messages = encodeMessages(c.type, c.values);
  const bbsProof = await bbs.deriveProof({
    publicKey,
    signature: base64urlToBytes(c.signature),
    header: headerFor(c.type),
    messages,
    presentationHeader: nonce,
    disclosedMessageIndexes,
    ciphersuite: CIPHERSUITE,
  });
  const disclosed: Record<string, string> = {};
  for (const idx of disclosedMessageIndexes) disclosed[String(idx)] = bytesToUtf8(messages[idx]!);
  return { disclosed, bbsProof };
}

/** Fails closed: returns false on a bad proof, wrong nonce, missing mandatory meta or malformed input. */
export async function verifyDisclosure(i: {
  publicKey: Uint8Array;
  type: CredentialType;
  disclosed: Record<string, string>;
  bbsProof: Uint8Array;
  nonce: Uint8Array;
}): Promise<boolean> {
  try {
    const fieldCount = layoutOf(i.type).fields.length;
    const entries = Object.entries(i.disclosed).map(([k, v]) => {
      if (!/^(0|[1-9]\d*)$/.test(k)) throw new Error("bad index");
      const idx = Number(k);
      if (idx >= fieldCount) throw new Error("index out of range");
      return [idx, v] as const;
    });
    entries.sort((a, b) => a[0] - b[0]);
    const indexes = entries.map(([idx]) => idx);
    if (!mandatoryIndices().every((m) => indexes.includes(m))) return false;
    if (i.disclosed["0"] !== i.type) return false;
    return await bbs.verifyProof({
      publicKey: i.publicKey,
      proof: i.bbsProof,
      header: headerFor(i.type),
      presentationHeader: i.nonce,
      disclosedMessages: entries.map(([, v]) => utf8ToBytes(v)),
      disclosedMessageIndexes: indexes,
      ciphersuite: CIPHERSUITE,
    });
  } catch {
    return false;
  }
}
