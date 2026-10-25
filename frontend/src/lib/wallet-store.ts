// frontend/src/lib/wallet-store.ts
// The holder wallet lives only in this browser (IndexedDB via idb-keyval) and, encrypted with the holder's
// passphrase, as a server backup. The passphrase is kept in memory only and asked again after a reload.

import { get, set, del } from 'idb-keyval';
import { BACKUP_KDF_ITERATIONS, walletCrypto, type SignedCredential } from './zk';

const STORE_KEY = 'zkred_wallet_v1';
/** Bumped if the backup's JSON shape changes. */
export const BACKUP_VERSION = 1;

export interface StoredCredential {
  /** The offer this credential arrived in (stable local id). */
  offer_id: string;
  issuer_id: string;
  received_at: string;
  credential: SignedCredential;
}

export interface WalletData {
  wallet_id: string;
  wallet_token: string;
  display_name: string;
  private_key_jwk: JsonWebKey;
  credentials: StoredCredential[];
}

export async function loadWallet(): Promise<WalletData | null> {
  return (await get<WalletData>(STORE_KEY)) ?? null;
}

export async function saveWallet(w: WalletData): Promise<void> {
  await set(STORE_KEY, w);
}

export async function forgetWallet(): Promise<void> {
  await del(STORE_KEY);
  passphrase = null;
}

// ---------------------------------------------------------------- passphrase (memory only)

let passphrase: string | null = null;
export const getPassphrase = (): string | null => passphrase;
export const setPassphrase = (p: string | null): void => {
  passphrase = p;
};

/** Everything needed to rebuild the wallet on a new browser, encrypted with the passphrase (PBKDF2 → AES-GCM). */
export async function encryptWalletBackup(w: WalletData, pass: string) {
  const b = await walletCrypto.encryptBackup(pass, w, BACKUP_KDF_ITERATIONS);
  return { ...b, version: BACKUP_VERSION };
}

/** Throws ZkCoreError("BAD_PASSPHRASE") on a wrong passphrase. */
export async function decryptWalletBackup(
  pass: string,
  b: { ciphertext: string; iv: string; salt: string; kdf_iterations: number },
): Promise<WalletData> {
  const data = (await walletCrypto.decryptBackup(pass, b)) as WalletData;
  if (!data?.wallet_id || !data.private_key_jwk || !Array.isArray(data.credentials)) {
    throw new Error('This backup is not a ZKred wallet');
  }
  return data;
}
