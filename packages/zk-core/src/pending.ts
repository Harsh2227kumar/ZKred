// Public API members listed in CONTRACTS §4.1 whose implementation lands in V1.1-H1 (Merkle, status list,
// buildPresentation). They throw ZkCoreError("NOT_IMPLEMENTED") so nothing can silently "succeed" before then.
import { notImplemented } from "./errors";
import type { Presentation, PresentationPolicy } from "./policy";
import type { Hex32, SignedCredential, ZkArtifacts } from "./types";

const TASK = "V1.1";

export function merkleRoot(_leaves: Hex32[]): Hex32 {
  return notImplemented("merkleRoot", TASK);
}

export function merkleProof(_leaves: Hex32[], _leaf: Hex32): Hex32[] {
  return notImplemented("merkleProof", TASK);
}

export function verifyMerkleProof(_root: Hex32, _leaf: Hex32, _proof: Hex32[]): boolean {
  return notImplemented("verifyMerkleProof", TASK);
}

export const statusList: {
  create(size: number): Uint8Array;
  setBit(l: Uint8Array, i: number, v: boolean): void;
  getBit(l: Uint8Array, i: number): boolean;
  encode(l: Uint8Array): string;
  decode(s: string): Uint8Array;
  hash(l: Uint8Array): Hex32;
} = {
  create: () => notImplemented("statusList.create", TASK),
  setBit: () => notImplemented("statusList.setBit", TASK),
  getBit: () => notImplemented("statusList.getBit", TASK),
  encode: () => notImplemented("statusList.encode", TASK),
  decode: () => notImplemented("statusList.decode", TASK),
  hash: () => notImplemented("statusList.hash", TASK),
};

export async function buildPresentation(_i: {
  request: { id: string; nonce: string; policy: PresentationPolicy };
  credentials: SignedCredential[];
  issuerPublicKeys: Record<Hex32, Uint8Array>;
  batchLeaves: Record<Hex32, Hex32[]>;
  todayDays: number;
  artifacts: ZkArtifacts;
}): Promise<Presentation> {
  return notImplemented("buildPresentation", TASK);
}
