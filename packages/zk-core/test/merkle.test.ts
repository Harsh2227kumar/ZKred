import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, concatBytes, hexToBytes } from "@noble/hashes/utils.js";
import { describe, expect, it } from "vitest";
import { merkleProof, merkleRoot, verifyMerkleProof, type Hex32 } from "../src";
import { randomHex32 } from "./factories";

const h = (b: Uint8Array): Hex32 => `0x${bytesToHex(keccak_256(b))}`;
const bytes = (x: Hex32) => hexToBytes(x.slice(2));
const leafHash = (leaf: Hex32) => h(bytes(leaf));
/** OpenZeppelin MerkleProof's commutative pair hash. */
const pair = (a: Hex32, b: Hex32) => (a.toLowerCase() < b.toLowerCase() ? h(concatBytes(bytes(a), bytes(b))) : h(concatBytes(bytes(b), bytes(a))));
const leavesOf = (n: number) => Array.from({ length: n }, randomHex32);

describe("merkle (keccak256, sorted pairs, hashed leaves)", () => {
  it("a single leaf's root is its leaf hash", () => {
    const [leaf] = leavesOf(1);
    expect(merkleRoot([leaf!])).toBe(leafHash(leaf!));
    expect(merkleProof([leaf!], leaf!)).toEqual([]);
    expect(verifyMerkleProof(merkleRoot([leaf!]), leaf!, [])).toBe(true);
  });

  it("matches a hand-built tree (odd node promoted)", () => {
    const [a, b, c] = leavesOf(3) as [Hex32, Hex32, Hex32];
    expect(merkleRoot([a, b, c])).toBe(pair(pair(leafHash(a), leafHash(b)), leafHash(c)));
  });

  it("every leaf of every size proves membership, proofs verify with the sorted-pair rule", () => {
    for (const n of [1, 2, 3, 4, 5, 7, 8, 9, 33]) {
      const leaves = leavesOf(n);
      const root = merkleRoot(leaves);
      for (const leaf of leaves) {
        const proof = merkleProof(leaves, leaf);
        expect(verifyMerkleProof(root, leaf, proof)).toBe(true);
        // Same computation OpenZeppelin's MerkleProof.processProof does, over the hashed leaf.
        expect(proof.reduce(pair, leafHash(leaf))).toBe(root);
      }
    }
  });

  it("the root does not depend on hex case", () => {
    const leaves = leavesOf(4);
    expect(merkleRoot(leaves.map((l) => l.toUpperCase().replace("0X", "0x") as Hex32))).toBe(merkleRoot(leaves));
  });

  it("rejects a leaf that is not in the tree, a wrong root and a tampered proof", () => {
    const leaves = leavesOf(6);
    const root = merkleRoot(leaves);
    const proof = merkleProof(leaves, leaves[2]!);
    expect(verifyMerkleProof(root, randomHex32(), proof)).toBe(false);
    expect(verifyMerkleProof(randomHex32(), leaves[2]!, proof)).toBe(false);
    expect(verifyMerkleProof(root, leaves[2]!, [randomHex32(), ...proof.slice(1)])).toBe(false);
    expect(verifyMerkleProof(root, leaves[2]!, proof.slice(1))).toBe(false);
  });

  it("ATTACK: an internal node cannot be presented as a leaf (second preimage)", () => {
    const leaves = leavesOf(4);
    const root = merkleRoot(leaves);
    const internal = pair(leafHash(leaves[0]!), leafHash(leaves[1]!));
    const sibling = pair(leafHash(leaves[2]!), leafHash(leaves[3]!));
    expect(verifyMerkleProof(root, internal, [sibling])).toBe(false);
  });

  it("fails closed on malformed input", () => {
    const leaves = leavesOf(3);
    const root = merkleRoot(leaves);
    expect(verifyMerkleProof(root, "0x1234" as Hex32, [])).toBe(false);
    expect(verifyMerkleProof(root, leaves[0]!, ["nope" as Hex32])).toBe(false);
    expect(() => merkleRoot([])).toThrow(expect.objectContaining({ code: "EMPTY_TREE" }));
    expect(() => merkleRoot(["0xzz" as Hex32])).toThrow(expect.objectContaining({ code: "INVALID_HEX32" }));
    expect(() => merkleProof(leaves, randomHex32())).toThrow(expect.objectContaining({ code: "LEAF_NOT_FOUND" }));
  });
});
