// AES-256-GCM encryption of issuer secrets at rest (AGENTS.md §1.1 operational exception).
// BBS secret keys use KEY_ENCRYPTION_SECRET; issuer governance EVM keys use GOVERNANCE_KEY_ENCRYPTION_SECRET.
// The row's identity (key_id / did) is bound as AAD, so a ciphertext copied into another row fails to decrypt.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { config } from "../config";

export type SecretPurpose = "bbs_secret_key" | "governance_key";

const KEYS: Record<SecretPurpose, Buffer> = {
  bbs_secret_key: Buffer.from(config.KEY_ENCRYPTION_SECRET, "base64"),
  governance_key: Buffer.from(config.GOVERNANCE_KEY_ENCRYPTION_SECRET, "base64"),
};

const VERSION = "v1";
const IV_BYTES = 12;

const aad = (purpose: SecretPurpose, context: string) => Buffer.from(`zkred:${purpose}:${context}`, "utf8");

/** Returns `v1.<iv>.<ciphertext>.<tag>` (base64url parts). */
export function sealSecret(purpose: SecretPurpose, context: string, plaintext: Uint8Array): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", KEYS[purpose], iv);
  cipher.setAAD(aad(purpose, context));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return [VERSION, iv, ciphertext, cipher.getAuthTag()].map((p) => (typeof p === "string" ? p : p.toString("base64url"))).join(".");
}

/** Throws on a wrong key, wrong purpose/context or any tampering. */
export function openSecret(purpose: SecretPurpose, context: string, sealed: string): Uint8Array {
  const [version, iv, ciphertext, tag, ...rest] = sealed.split(".");
  if (version !== VERSION || !iv || !ciphertext || !tag || rest.length) throw new Error("malformed sealed secret");
  const decipher = createDecipheriv("aes-256-gcm", KEYS[purpose], Buffer.from(iv, "base64url"));
  decipher.setAAD(aad(purpose, context));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return new Uint8Array(Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64url")), decipher.final()]));
}
