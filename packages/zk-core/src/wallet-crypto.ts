// Wallet-side crypto on WebCrypto only (browsers + Node 22). The wallet UI and backend call these; never raw crypto.
//  - Offers: ECDH-ES (P-256, ephemeral sender key) → HKDF-SHA256 → AES-256-GCM over the SignedCredential JSON.
//  - Backups: PBKDF2-SHA256(passphrase, salt, iterations) → AES-256-GCM over JSON.
import { base64urlToBytes, bytesToBase64url, bytesToUtf8, utf8ToBytes } from "./encoding";
import { ZkCoreError } from "./errors";
import type { SignedCredential } from "./types";

// Local type names: consumers compile this source with or without the DOM lib (the backend has only @types/node).
type KeyUsage = "encrypt" | "decrypt";
/** EC private key in JWK form, as returned by generateWalletKeyPair. */
export interface JsonWebKey {
  kty?: string;
  crv?: string;
  x?: string;
  y?: string;
  d?: string;
  ext?: boolean;
  key_ops?: string[];
}

const OFFER_HKDF_INFO = utf8ToBytes("zkred:offer:v1");
const ECDH_PARAMS = { name: "ECDH", namedCurve: "P-256" } as const;
const IV_BYTES = 12;
const SALT_BYTES = 16;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new ZkCoreError("WEBCRYPTO_UNAVAILABLE", "WebCrypto (crypto.subtle) is not available in this runtime");
  return s;
}

function randomBytes(n: number): Uint8Array<ArrayBuffer> {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

/** Copies into a fresh ArrayBuffer-backed view (the WebCrypto BufferSource type rejects SharedArrayBuffer views). */
function buf(b: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(b);
}

async function offerKey(privateKey: CryptoKey, publicKey: CryptoKey, usage: KeyUsage): Promise<CryptoKey> {
  const shared = await subtle().deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const hkdfKey = await subtle().importKey("raw", shared, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: buf(OFFER_HKDF_INFO) },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

async function backupKey(passphrase: string, salt: Uint8Array, iterations: number, usage: KeyUsage): Promise<CryptoKey> {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new ZkCoreError("INVALID_KDF_ITERATIONS", "kdf_iterations must be a positive integer");
  }
  const base = await subtle().importKey("raw", buf(utf8ToBytes(passphrase)), "PBKDF2", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

async function generateWalletKeyPair(): Promise<{ publicKeyB64: string; privateKeyJwk: JsonWebKey }> {
  const pair = await subtle().generateKey(ECDH_PARAMS, true, ["deriveBits"]);
  const raw = new Uint8Array(await subtle().exportKey("raw", pair.publicKey));
  const privateKeyJwk = await subtle().exportKey("jwk", pair.privateKey);
  return { publicKeyB64: bytesToBase64url(raw), privateKeyJwk };
}

async function encryptOffer(
  recipientPublicKeyB64: string,
  cred: SignedCredential,
): Promise<{ ephemeral_public_key: string; iv: string; ciphertext: string }> {
  let recipient: CryptoKey;
  try {
    recipient = await subtle().importKey("raw", buf(base64urlToBytes(recipientPublicKeyB64)), ECDH_PARAMS, false, []);
  } catch {
    throw new ZkCoreError("INVALID_PUBLIC_KEY", "recipient public key is not a valid raw P-256 key");
  }
  const ephemeral = await subtle().generateKey(ECDH_PARAMS, true, ["deriveBits"]);
  const key = await offerKey(ephemeral.privateKey, recipient, "encrypt");
  const iv = randomBytes(IV_BYTES);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, buf(utf8ToBytes(JSON.stringify(cred))));
  const epk = new Uint8Array(await subtle().exportKey("raw", ephemeral.publicKey));
  return {
    ephemeral_public_key: bytesToBase64url(epk),
    iv: bytesToBase64url(iv),
    ciphertext: bytesToBase64url(new Uint8Array(ct)),
  };
}

async function decryptOffer(
  privateKeyJwk: JsonWebKey,
  offer: { ephemeral_public_key: string; iv: string; ciphertext: string },
): Promise<SignedCredential> {
  try {
    const priv = await subtle().importKey("jwk", privateKeyJwk, ECDH_PARAMS, false, ["deriveBits"]);
    const epk = await subtle().importKey("raw", buf(base64urlToBytes(offer.ephemeral_public_key)), ECDH_PARAMS, false, []);
    const key = await offerKey(priv, epk, "decrypt");
    const pt = await subtle().decrypt(
      { name: "AES-GCM", iv: buf(base64urlToBytes(offer.iv)) },
      key,
      buf(base64urlToBytes(offer.ciphertext)),
    );
    return JSON.parse(bytesToUtf8(new Uint8Array(pt))) as SignedCredential;
  } catch {
    throw new ZkCoreError("OFFER_DECRYPT_FAILED", "could not decrypt the credential offer with this wallet key");
  }
}

async function encryptBackup(
  passphrase: string,
  data: unknown,
  kdfIterations: number,
): Promise<{ ciphertext: string; iv: string; salt: string; kdf_iterations: number }> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await backupKey(passphrase, salt, kdfIterations, "encrypt");
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, buf(utf8ToBytes(JSON.stringify(data))));
  return {
    ciphertext: bytesToBase64url(new Uint8Array(ct)),
    iv: bytesToBase64url(iv),
    salt: bytesToBase64url(salt),
    kdf_iterations: kdfIterations,
  };
}

async function decryptBackup(
  passphrase: string,
  b: { ciphertext: string; iv: string; salt: string; kdf_iterations: number },
): Promise<unknown> {
  const key = await backupKey(passphrase, base64urlToBytes(b.salt), b.kdf_iterations, "decrypt");
  let pt: ArrayBuffer;
  try {
    pt = await subtle().decrypt(
      { name: "AES-GCM", iv: buf(base64urlToBytes(b.iv)) },
      key,
      buf(base64urlToBytes(b.ciphertext)),
    );
  } catch {
    throw new ZkCoreError("BAD_PASSPHRASE", "wrong passphrase or corrupted backup");
  }
  return JSON.parse(bytesToUtf8(new Uint8Array(pt)));
}

export const walletCrypto = {
  generateWalletKeyPair,
  encryptOffer,
  decryptOffer,
  encryptBackup,
  decryptBackup,
};
