// Test-only factories: build credential values from the layouts with random content (no literal records).
import { CREDENTIAL_LAYOUTS, type CredentialType } from "../src";

export function randomHex32(): `0x${string}` {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

export function randomText(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/** Values for every field of `type`; meta fields that the signer checks get well-formed values. */
export function buildValues(type: CredentialType, keyId: `0x${string}`, issuerDid: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const f of CREDENTIAL_LAYOUTS[type].fields) {
    if (f.kind === "int") values[f.name] = String(Math.floor(Math.random() * 1000));
    else if (f.kind === "date") values[f.name] = new Date(Date.now() - Math.random() * 1e12).toISOString().slice(0, 10);
    else values[f.name] = randomText(f.name);
  }
  values.cred_type = type;
  values.key_id = keyId;
  values.issuer_did = issuerDid;
  values.commitment = randomHex32();
  return values;
}
