// Revocation status list (W3C Bitstring Status List style; CONTRACTS §4.1). Bit i = 1 means credential i is revoked.
// Index 0 is the most significant bit of byte 0. Over the wire: gzip + base64url. On-chain: keccak256 of the raw bits.
import { keccak_256 } from "@noble/hashes/sha3.js";
import { gunzipSync, gzipSync } from "fflate";
import { base64urlToBytes, bytesToBase64url, bytesToHex32 } from "./encoding";
import { ZkCoreError } from "./errors";
import type { Hex32 } from "./types";

function position(l: Uint8Array, i: number): { byte: number; mask: number } {
  if (!Number.isInteger(i) || i < 0 || i >= l.length * 8) {
    throw new ZkCoreError("STATUS_INDEX_OUT_OF_RANGE", `status index ${i} is outside a list of ${l.length * 8} entries`);
  }
  return { byte: i >> 3, mask: 0x80 >> (i & 7) };
}

export const statusList = {
  create(size: number): Uint8Array {
    if (!Number.isInteger(size) || size <= 0) throw new ZkCoreError("INVALID_STATUS_LIST", "size must be a positive integer");
    return new Uint8Array(Math.ceil(size / 8));
  },
  setBit(l: Uint8Array, i: number, v: boolean): void {
    const { byte, mask } = position(l, i);
    l[byte] = v ? l[byte]! | mask : l[byte]! & ~mask;
  },
  getBit(l: Uint8Array, i: number): boolean {
    const { byte, mask } = position(l, i);
    return (l[byte]! & mask) !== 0;
  },
  encode(l: Uint8Array): string {
    // mtime 0 keeps the encoding deterministic for the same bits.
    return bytesToBase64url(gzipSync(l, { mtime: 0 }));
  },
  decode(s: string): Uint8Array {
    try {
      return gunzipSync(base64urlToBytes(s));
    } catch {
      throw new ZkCoreError("INVALID_STATUS_LIST", "status list is not gzip + base64url");
    }
  },
  hash(l: Uint8Array): Hex32 {
    return bytesToHex32(keccak_256(l));
  },
};
