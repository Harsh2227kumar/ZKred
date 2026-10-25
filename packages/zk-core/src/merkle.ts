// Merkle batch tree (CONTRACTS §4.1): keccak256 with sorted (commutative) pairs, as OpenZeppelin MerkleProof.
// Leaves are hashed once (keccak256 of the 32-byte commitment) before entering the tree. Internal nodes hash 64 bytes,
// leaves 32, so an internal node can never be passed off as a leaf (second-preimage attack).
// An odd node at the end of a level is promoted unchanged.
import { keccak_256 } from "@noble/hashes/sha3.js";
import { concatBytes, hexToBytes } from "@noble/hashes/utils.js";
import { bytesToHex32 } from "./encoding";
import { ZkCoreError } from "./errors";
import type { Hex32 } from "./types";

const HEX32_RE = /^0x[0-9a-fA-F]{64}$/;

function toBytes(x: Hex32): Uint8Array {
  if (typeof x !== "string" || !HEX32_RE.test(x)) throw new ZkCoreError("INVALID_HEX32", `not a 32-byte hex value: ${String(x)}`);
  return hexToBytes(x.slice(2));
}

function compare(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
  return 0;
}

const hashLeaf = (leaf: Hex32): Uint8Array => keccak_256(toBytes(leaf));
const hashPair = (a: Uint8Array, b: Uint8Array): Uint8Array =>
  keccak_256(compare(a, b) <= 0 ? concatBytes(a, b) : concatBytes(b, a));

/** All levels, leaves first, root last. */
function levels(leaves: Hex32[]): Uint8Array[][] {
  if (leaves.length === 0) throw new ZkCoreError("EMPTY_TREE", "a Merkle tree needs at least one leaf");
  const out = [leaves.map(hashLeaf)];
  while (out[out.length - 1]!.length > 1) {
    const level = out[out.length - 1]!;
    const next: Uint8Array[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? hashPair(level[i]!, level[i + 1]!) : level[i]!);
    out.push(next);
  }
  return out;
}

export function merkleRoot(leaves: Hex32[]): Hex32 {
  const all = levels(leaves);
  return bytesToHex32(all[all.length - 1]![0]!);
}

/** Sibling hashes from the leaf up. Throws LEAF_NOT_FOUND if `leaf` is not in `leaves`. */
export function merkleProof(leaves: Hex32[], leaf: Hex32): Hex32[] {
  const target = toBytes(leaf);
  let index = leaves.findIndex((l) => compare(toBytes(l), target) === 0);
  if (index < 0) throw new ZkCoreError("LEAF_NOT_FOUND", "leaf is not in this batch");
  const proof: Hex32[] = [];
  for (const level of levels(leaves).slice(0, -1)) {
    const sibling = index % 2 === 0 ? index + 1 : index - 1;
    if (sibling < level.length) proof.push(bytesToHex32(level[sibling]!));
    index = Math.floor(index / 2);
  }
  return proof;
}

/** Fails closed: malformed input returns false. */
export function verifyMerkleProof(root: Hex32, leaf: Hex32, proof: Hex32[]): boolean {
  try {
    const computed = proof.reduce((node, sibling) => hashPair(node, toBytes(sibling)), hashLeaf(leaf));
    return compare(computed, toBytes(root)) === 0;
  } catch {
    return false;
  }
}
