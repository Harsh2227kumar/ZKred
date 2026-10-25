// Minimal typings for @digitalbazaar/bbs-signatures (the package ships no .d.ts). Only src/bbs.ts imports it.
declare module "@digitalbazaar/bbs-signatures" {
  export const CIPHERSUITES: { readonly BLS12381_SHAKE256: string; readonly BLS12381_SHA256: string };

  export function generateKeyPair(o?: { seed?: Uint8Array; ciphersuite?: string }): Promise<{
    secretKey: Uint8Array;
    publicKey: Uint8Array;
  }>;
  export function secretKeyToPublicKey(o: { secretKey: Uint8Array; ciphersuite?: string }): Promise<Uint8Array>;
  export function sign(o: {
    secretKey: Uint8Array;
    publicKey?: Uint8Array;
    header: Uint8Array;
    messages: Uint8Array[];
    ciphersuite?: string;
  }): Promise<Uint8Array>;
  export function verifySignature(o: {
    publicKey: Uint8Array;
    signature: Uint8Array;
    header: Uint8Array;
    messages: Uint8Array[];
    ciphersuite?: string;
  }): Promise<boolean>;
  export function deriveProof(o: {
    publicKey: Uint8Array;
    signature: Uint8Array;
    header: Uint8Array;
    messages: Uint8Array[];
    presentationHeader: Uint8Array;
    disclosedMessageIndexes: number[];
    ciphersuite?: string;
  }): Promise<Uint8Array>;
  export function verifyProof(o: {
    publicKey: Uint8Array;
    proof: Uint8Array;
    header: Uint8Array;
    presentationHeader: Uint8Array;
    disclosedMessages: Uint8Array[];
    disclosedMessageIndexes: number[];
    ciphersuite?: string;
  }): Promise<boolean>;
}
