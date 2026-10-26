// frontend/src/lib/wallet-crypto.ts
// ⚓ Anchor: Sole consumer of @zkred/zk-core for wallet operations (AGENTS.md §8.3).
import { walletCrypto, verifyCredential, type SignedCredential } from '@zkred/zk-core';

export type { SignedCredential };

/**
 * Base64url to Uint8Array helper for public key bytes.
 */
export function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Generates in-browser ECDH P-256 keypair via WebCrypto.
 */
export async function generateWalletKeyPair(): Promise<{
  publicKeyB64: string;
  privateKeyJwk: any;
}> {
  return walletCrypto.generateWalletKeyPair();
}

/**
 * Decrypts an end-to-end encrypted offer using recipient's private key.
 */
export async function decryptOffer(
  privateKeyJwk: any,
  offer: { ephemeral_public_key: string; iv: string; ciphertext: string }
): Promise<SignedCredential> {
  return walletCrypto.decryptOffer(privateKeyJwk, offer);
}

/**
 * Verifies BBS+ signature of a credential against the issuer's BLS12-381 G2 public key.
 */
export async function verifyCredentialSignature(
  credential: SignedCredential,
  issuerPublicKeyB64: string
): Promise<boolean> {
  const pubKeyBytes = base64urlToBytes(issuerPublicKeyB64);
  return verifyCredential(credential, pubKeyBytes);
}

/**
 * Encrypts all wallet data using PBKDF2-SHA256 (100,000 iterations) + AES-256-GCM.
 */
export async function encryptWalletBackup(passphrase: string, data: unknown): Promise<{
  ciphertext: string;
  iv: string;
  salt: string;
  kdf_iterations: number;
}> {
  return walletCrypto.encryptBackup(passphrase, data, 100_000);
}

/**
 * Decrypts wallet backup with the holder's passphrase.
 */
export async function decryptWalletBackup(
  passphrase: string,
  backup: { ciphertext: string; iv: string; salt: string; kdf_iterations: number }
): Promise<unknown> {
  return walletCrypto.decryptBackup(passphrase, backup);
}
