import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { gunzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { statusList } from "../src";
import { base64urlToBytes } from "../src/encoding";

describe("statusList (W3C Bitstring Status List style)", () => {
  it("creates an all-zero list of ceil(size/8) bytes", () => {
    const l = statusList.create(16384);
    expect(l).toHaveLength(2048);
    expect(l.every((b) => b === 0)).toBe(true);
    expect(statusList.create(9)).toHaveLength(2);
  });

  it("index 0 is the left-most (most significant) bit of byte 0", () => {
    const l = statusList.create(16);
    statusList.setBit(l, 0, true);
    statusList.setBit(l, 15, true);
    expect(Array.from(l)).toEqual([0b1000_0000, 0b0000_0001]);
  });

  it("set/get/clear touch exactly one bit", () => {
    const l = statusList.create(1024);
    statusList.setBit(l, 77, true);
    for (let i = 0; i < 1024; i++) expect(statusList.getBit(l, i)).toBe(i === 77);
    statusList.setBit(l, 77, false);
    expect(l.every((b) => b === 0)).toBe(true);
  });

  it("rejects out-of-range or non-integer indices instead of touching another holder's bit", () => {
    const l = statusList.create(16);
    for (const bad of [-1, 16, 1.5, Number.NaN]) {
      expect(() => statusList.setBit(l, bad, true)).toThrow(expect.objectContaining({ code: "STATUS_INDEX_OUT_OF_RANGE" }));
      expect(() => statusList.getBit(l, bad)).toThrow(expect.objectContaining({ code: "STATUS_INDEX_OUT_OF_RANGE" }));
    }
    expect(() => statusList.create(0)).toThrow();
  });

  it("encode = gzip + base64url, and decode round-trips", () => {
    const l = statusList.create(16384);
    statusList.setBit(l, 4242, true);
    const encoded = statusList.encode(l);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(gunzipSync(base64urlToBytes(encoded))).toEqual(l);
    expect(statusList.decode(encoded)).toEqual(l);
    expect(encoded.length).toBeLessThan(200); // herd-privacy list stays tiny over the wire
  });

  it("decode rejects garbage", () => {
    expect(() => statusList.decode("not gzip")).toThrow(expect.objectContaining({ code: "INVALID_STATUS_LIST" }));
    expect(() => statusList.decode("AAAA")).toThrow(expect.objectContaining({ code: "INVALID_STATUS_LIST" }));
  });

  it("hash = keccak256 of the raw bitstring; flipping one bit changes it", () => {
    const l = statusList.create(1024);
    expect(statusList.hash(l)).toBe(`0x${bytesToHex(keccak_256(l))}`);
    const before = statusList.hash(l);
    statusList.setBit(l, 3, true);
    expect(statusList.hash(l)).not.toBe(before);
  });
});
