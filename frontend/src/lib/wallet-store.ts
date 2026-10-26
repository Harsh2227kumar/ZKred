// frontend/src/lib/wallet-store.ts
// IndexedDB storage management for holder keys, token, and claimed credentials via idb-keyval.
import { get, set, del } from 'idb-keyval';
import type { SignedCredential } from './wallet-crypto';
import { walletCrypto } from './zk';

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
  /** Commitments of credentials replaced by a refreshed copy (breach recovery). Optional: older backups lack it. */
  replaced_commitments?: string[];
  exported_at: string;
}

const META_KEY = 'zkred_wallet_meta';
const KEYPAIR_KEY = 'zkred_wallet_key';
const CREDENTIALS_KEY = 'zkred_credentials';
const REPLACED_KEY = 'zkred_replaced_commitments';

// ---------------------------------------------------------------- device (biometric) lock
// With the lock on, the four keys below are not in IndexedDB at all: one record holds them sealed under the WebAuthn
// PRF secret (lib/biometric-unlock.ts → walletCrypto.sealWithDeviceSecret), and the plaintext lives in memory only
// after an unlock in this page. Every read fails closed while locked.
const DEVICE_LOCK_KEY = 'zkred_device_lock';
const LOCKED_KEYS = [META_KEY, KEYPAIR_KEY, CREDENTIALS_KEY, REPLACED_KEY] as const;
type LockedKey = (typeof LOCKED_KEYS)[number];
type LockedValues = Partial<Record<LockedKey, unknown>>;

export interface DeviceLock {
  credential_id: Uint8Array<ArrayBuffer>;
  prf_salt: Uint8Array<ArrayBuffer>;
  sealed: { ciphertext: string; iv: string; salt: string };
}

export class WalletLockedError extends Error {
  constructor() {
    super('Unlock the wallet with your fingerprint, face or device PIN first.');
    this.name = 'WalletLockedError';
  }
}

let unlocked: { secret: Uint8Array; lock: DeviceLock; values: LockedValues } | null = null;
let resealing: Promise<void> = Promise.resolve();

export async function getDeviceLock(): Promise<DeviceLock | null> {
  return (await get<DeviceLock>(DEVICE_LOCK_KEY)) ?? null;
}

/** True if this device's wallet is sealed and has not been unlocked in this page yet. */
export async function isWalletLocked(): Promise<boolean> {
  return !unlocked && (await getDeviceLock()) !== null;
}

async function readValue<T>(key: LockedKey): Promise<T | undefined> {
  if (unlocked) return unlocked.values[key] as T | undefined;
  if (await getDeviceLock()) throw new WalletLockedError();
  return get<T>(key);
}

async function writeValue(key: LockedKey, value: unknown): Promise<void> {
  const u = unlocked;
  if (!u) {
    if (await getDeviceLock()) throw new WalletLockedError();
    await set(key, value);
    return;
  }
  u.values[key] = value;
  // Serialised so an older seal never overwrites a newer one.
  resealing = resealing
    .catch(() => undefined)
    .then(async () => {
      const lock = { ...u.lock, sealed: await walletCrypto.sealWithDeviceSecret(u.secret, u.values) };
      await set(DEVICE_LOCK_KEY, lock);
      u.lock = lock;
    });
  await resealing;
}

/** Throws ZkCoreError("DEVICE_UNLOCK_FAILED") if the secret does not open this device's wallet. */
export async function unlockWithDeviceSecret(secret: Uint8Array): Promise<void> {
  const lock = await getDeviceLock();
  if (!lock) return;
  const values = (await walletCrypto.openWithDeviceSecret(secret, lock.sealed)) as LockedValues;
  unlocked = { secret, lock, values };
}

/** Forgets the unlocked copy (and passphrase) from memory; the next read needs the biometric again. */
export function lockWallet(): void {
  unlocked = null;
  clearSessionPassphrase();
}

/** Seals the plaintext wallet under the device secret, checks it opens, then deletes the plaintext keys. */
export async function enableDeviceLock(e: { credentialId: Uint8Array<ArrayBuffer>; prfSalt: Uint8Array<ArrayBuffer>; secret: Uint8Array }): Promise<void> {
  if (await getDeviceLock()) throw new Error('Biometric lock is already on for this wallet.');
  const values: LockedValues = {};
  for (const k of LOCKED_KEYS) {
    const v = await get(k);
    if (v !== undefined) values[k] = v;
  }
  if (!values[META_KEY] || !values[KEYPAIR_KEY]) throw new Error('There is no wallet on this device to protect.');
  const lock: DeviceLock = {
    credential_id: e.credentialId,
    prf_salt: e.prfSalt,
    sealed: await walletCrypto.sealWithDeviceSecret(e.secret, values),
  };
  await walletCrypto.openWithDeviceSecret(e.secret, lock.sealed);
  await set(DEVICE_LOCK_KEY, lock);
  for (const k of LOCKED_KEYS) await del(k);
  unlocked = { secret: e.secret, lock, values };
}

/** Writes the unlocked wallet back as plaintext IndexedDB keys and removes the sealed record. */
export async function disableDeviceLock(): Promise<void> {
  const u = unlocked;
  if (!u) throw new WalletLockedError();
  await resealing.catch(() => undefined);
  for (const k of LOCKED_KEYS) if (u.values[k] !== undefined) await set(k, u.values[k]);
  await del(DEVICE_LOCK_KEY);
  unlocked = null;
}

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
  const meta = await readValue<WalletMetadata>(META_KEY);
  return meta || null;
}

export async function saveWalletMetadata(meta: WalletMetadata): Promise<void> {
  await writeValue(META_KEY, meta);
}

export async function getWalletKeypair(): Promise<WalletKeypair | null> {
  const keys = await readValue<WalletKeypair>(KEYPAIR_KEY);
  return keys || null;
}

export async function saveWalletKeypair(keys: WalletKeypair): Promise<void> {
  await writeValue(KEYPAIR_KEY, keys);
}

export async function getStoredCredentials(): Promise<SignedCredential[]> {
  const creds = await readValue<SignedCredential[]>(CREDENTIALS_KEY);
  return creds || [];
}

export async function saveStoredCredentials(creds: SignedCredential[]): Promise<void> {
  await writeValue(CREDENTIALS_KEY, creds);
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

/** Removes one credential (by commitment) from this device; returns what is left. */
export async function removeStoredCredential(commitment: string): Promise<SignedCredential[]> {
  const remaining = (await getStoredCredentials()).filter((c) => c.values?.commitment !== commitment);
  await saveStoredCredentials(remaining);
  await writeValue(REPLACED_KEY, (await getReplacedCommitments()).filter((c) => c !== commitment));
  return remaining;
}

/** Commitments of credentials whose refreshed copy was requested: they are never offered to verifiers again. */
export async function getReplacedCommitments(): Promise<string[]> {
  return (await readValue<string[]>(REPLACED_KEY)) ?? [];
}

export async function markCredentialReplaced(commitment: string): Promise<string[]> {
  const replaced = await getReplacedCommitments();
  const next = replaced.includes(commitment) ? replaced : [...replaced, commitment];
  await writeValue(REPLACED_KEY, next);
  return next;
}

export async function clearWalletStore(): Promise<void> {
  await del(META_KEY);
  await del(KEYPAIR_KEY);
  await del(CREDENTIALS_KEY);
  await del(REPLACED_KEY);
  await del(DEVICE_LOCK_KEY);
  unlocked = null;
  clearSessionPassphrase();
}

/**
 * Packs all wallet data for encrypted backup.
 */
export async function getFullWalletState(): Promise<FullWalletBackupState | null> {
  const meta = await getWalletMetadata();
  const keys = await getWalletKeypair();
  const creds = await getStoredCredentials();
  const replaced = await getReplacedCommitments();

  if (!meta || !keys) return null;

  return {
    version: 1,
    metadata: meta,
    keypair: keys,
    credentials: creds,
    replaced_commitments: replaced,
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
  // A restore replaces this device's wallet, so any biometric lock on the old one goes with it.
  await del(DEVICE_LOCK_KEY);
  unlocked = null;
  await saveWalletMetadata(state.metadata);
  await saveWalletKeypair(state.keypair);
  await saveStoredCredentials(state.credentials || []);
  await writeValue(REPLACED_KEY, state.replaced_commitments ?? []);
}
