// frontend/src/lib/wallet-store.ts
// IndexedDB storage management for holder keys, token, and claimed credentials via idb-keyval.
import { get, set, del } from 'idb-keyval';
import type { SignedCredential } from './wallet-crypto';

export interface WalletMetadata {
  id: string;
  display_name: string;
  wallet_token: string;
}

export interface WalletKeypair {
  privateKeyJwk: any;
  publicKeyB64: string;
}

export interface FullWalletBackupState {
  version: number;
  metadata: WalletMetadata;
  keypair: WalletKeypair;
  credentials: SignedCredential[];
  exported_at: string;
}

const META_KEY = 'zkred_wallet_meta';
const KEYPAIR_KEY = 'zkred_wallet_key';
const CREDENTIALS_KEY = 'zkred_credentials';

// Volatile in-memory passphrase (cleared on reload/close)
let memoryPassphrase = '';

export function getSessionPassphrase(): string {
  return memoryPassphrase;
}

export function setSessionPassphrase(passphrase: string): void {
  memoryPassphrase = passphrase.trim();
}

export function clearSessionPassphrase(): void {
  memoryPassphrase = '';
}

export async function getWalletMetadata(): Promise<WalletMetadata | null> {
  const meta = await get<WalletMetadata>(META_KEY);
  return meta || null;
}

export async function saveWalletMetadata(meta: WalletMetadata): Promise<void> {
  await set(META_KEY, meta);
}

export async function getWalletKeypair(): Promise<WalletKeypair | null> {
  const keys = await get<WalletKeypair>(KEYPAIR_KEY);
  return keys || null;
}

export async function saveWalletKeypair(keys: WalletKeypair): Promise<void> {
  await set(KEYPAIR_KEY, keys);
}

export async function getStoredCredentials(): Promise<SignedCredential[]> {
  const creds = await get<SignedCredential[]>(CREDENTIALS_KEY);
  return creds || [];
}

export async function saveStoredCredentials(creds: SignedCredential[]): Promise<void> {
  await set(CREDENTIALS_KEY, creds);
}

export async function addStoredCredential(cred: SignedCredential): Promise<SignedCredential[]> {
  const existing = await getStoredCredentials();
  // Prevent duplicate insertion by checking type + commitment or signature
  const commitment = cred.values?.commitment;
  const exists = existing.some(
    (c) => (commitment && c.values?.commitment === commitment) || c.signature === cred.signature
  );
  if (exists) return existing;

  const updated = [cred, ...existing];
  await saveStoredCredentials(updated);
  return updated;
}

export async function clearWalletStore(): Promise<void> {
  await del(META_KEY);
  await del(KEYPAIR_KEY);
  await del(CREDENTIALS_KEY);
  clearSessionPassphrase();
}

/**
 * Packs all wallet data for encrypted backup.
 */
export async function getFullWalletState(): Promise<FullWalletBackupState | null> {
  const meta = await getWalletMetadata();
  const keys = await getWalletKeypair();
  const creds = await getStoredCredentials();

  if (!meta || !keys) return null;

  return {
    version: 1,
    metadata: meta,
    keypair: keys,
    credentials: creds,
    exported_at: new Date().toISOString(),
  };
}

/**
 * Rehydrates IndexedDB from decrypted backup state.
 */
export async function restoreWalletState(state: FullWalletBackupState): Promise<void> {
  if (!state.metadata || !state.keypair) {
    throw new Error('Invalid wallet backup format');
  }
  await saveWalletMetadata(state.metadata);
  await saveWalletKeypair(state.keypair);
  await saveStoredCredentials(state.credentials || []);
}
