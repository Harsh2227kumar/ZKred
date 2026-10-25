// Byte/string codecs that work in Node and the browser (no Buffer).
import { bytesToHex } from "@noble/hashes/utils.js";
import type { Hex32 } from "./types";

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export const utf8ToBytes = (s: string): Uint8Array => utf8Encoder.encode(s);
export const bytesToUtf8 = (b: Uint8Array): string => utf8Decoder.decode(b);

export function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlToBytes(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("invalid base64url");
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export const bytesToHex32 = (b: Uint8Array): Hex32 => `0x${bytesToHex(b)}`;
