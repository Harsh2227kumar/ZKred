// Public API members listed in CONTRACTS §4.1 whose implementation lands in V1.1-H1 (buildPresentation).
// They throw ZkCoreError("NOT_IMPLEMENTED") so nothing can silently "succeed" before then.
import { notImplemented } from "./errors";
import type { Presentation, PresentationPolicy } from "./policy";
import type { Hex32, SignedCredential, ZkArtifacts } from "./types";

export async function buildPresentation(_i: {
  request: { id: string; nonce: string; policy: PresentationPolicy };
  credentials: SignedCredential[];
  issuerPublicKeys: Record<Hex32, Uint8Array>;
  batchLeaves: Record<Hex32, Hex32[]>;
  todayDays: number;
  artifacts: ZkArtifacts;
}): Promise<Presentation> {
  return notImplemented("buildPresentation", "V1.1");
}
