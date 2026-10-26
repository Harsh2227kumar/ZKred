import type { CredentialType } from "./layouts";

export type Hex32 = `0x${string}`;

/** A BBS-signed credential as held in the wallet. `values` holds every layout field by name (strings). */
export interface SignedCredential {
  type: CredentialType;
  issuer_did: string;
  key_id: Hex32;
  values: Record<string, string>;
  signature: string /* base64url */;
}

/** Groth16 artifacts, passed in by the caller (URL or bytes) so no `fs` is needed in the browser. */
export interface ZkArtifacts {
  wasm: ArrayBuffer | string;
  zkey: ArrayBuffer | string;
  vkey?: object;
}
