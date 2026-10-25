// The holder wallet session: IndexedDB copy + in-memory passphrase + server-side encrypted backup.
// Every change to the wallet is written to IndexedDB and then backed up (encrypted in the browser first).
import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiClient, unwrap } from '@/api/client';
import { claimOffer, createWallet, getBackup, listOffers, putBackup, requestReissue } from '@/api/queries/wallets';
import type { Issuer } from '@/api/schemas';
import {
  decryptWalletBackup,
  encryptWalletBackup,
  forgetWallet,
  getPassphrase,
  loadWallet,
  saveWallet,
  setPassphrase,
  type StoredCredential,
  type WalletData,
} from '@/lib/wallet-store';
import { credentialSignatureValid, walletCrypto, type SignedCredential } from '@/lib/zk';

/** Minimum passphrase length for the backup (VERSION-PLAN V1-S2). */
export const MIN_PASSPHRASE_LENGTH = 10;

export interface InboxResult {
  added: number;
  rejected: number;
}

export function useWalletSession() {
  const qc = useQueryClient();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unlocked, setUnlocked] = useState(Boolean(getPassphrase()));
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    loadWallet()
      .then(setWallet)
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback(async (next: WalletData) => {
    await saveWallet(next);
    setWallet(next);
    const pass = getPassphrase();
    if (!pass) throw new Error('Unlock the wallet with your passphrase to back up changes');
    const saved = await putBackup(next.wallet_id, next.wallet_token, await encryptWalletBackup(next, pass));
    setLastBackupAt(saved.updated_at);
  }, []);

  const create = useCallback(
    async (displayName: string, passphrase: string) => {
      const keys = await walletCrypto.generateWalletKeyPair();
      const created = await createWallet(displayName, keys.publicKeyB64);
      setPassphrase(passphrase);
      setUnlocked(true);
      await persist({
        wallet_id: created.id,
        wallet_token: created.wallet_token,
        display_name: created.display_name,
        private_key_jwk: keys.privateKeyJwk as JsonWebKey,
        credentials: [],
      });
    },
    [persist],
  );

  /** Rebuilds the wallet on this browser from the server backup (wallet id + token + passphrase). */
  const restore = useCallback(async (walletId: string, token: string, passphrase: string) => {
    const backup = await getBackup(walletId, token);
    const data = await decryptWalletBackup(passphrase, backup);
    await saveWallet(data);
    setPassphrase(passphrase);
    setUnlocked(true);
    setWallet(data);
    setLastBackupAt(backup.updated_at);
  }, []);

  /** Checks the passphrase against the server backup before keeping it in memory. */
  const unlock = useCallback(
    async (passphrase: string) => {
      if (!wallet) return;
      const backup = await getBackup(wallet.wallet_id, wallet.wallet_token);
      await decryptWalletBackup(passphrase, backup);
      setPassphrase(passphrase);
      setUnlocked(true);
      setLastBackupAt(backup.updated_at);
    },
    [wallet],
  );

  const backupNow = useCallback(async () => {
    if (wallet) await persist(wallet);
  }, [wallet, persist]);

  /**
   * Decrypts every offer not yet in this wallet, keeps it only if its BBS signature verifies under the issuer's
   * published key, then marks it claimed. Offers that fail verification are left unclaimed and reported.
   */
  const syncInbox = useCallback(async (): Promise<InboxResult> => {
    if (!wallet) return { added: 0, rejected: 0 };
    const offers = await listOffers(wallet.wallet_id, wallet.wallet_token);
    const known = new Set(wallet.credentials.map((c) => c.offer_id));
    const fresh = offers.filter((o) => !known.has(o.id));
    if (fresh.length === 0) return { added: 0, rejected: 0 };

    const issuers = (await unwrap(apiClient.GET('/issuers'))).items;
    const keyOf = new Map(issuers.flatMap((i: Issuer) => i.keys.map((k) => [k.key_id, k.public_key] as const)));
    const added: StoredCredential[] = [];
    let rejected = 0;
    for (const offer of fresh) {
      try {
        const credential = await walletCrypto.decryptOffer(wallet.private_key_jwk, offer);
        const publicKey = keyOf.get(credential.key_id);
        if (!publicKey || !(await credentialSignatureValid(credential, publicKey))) throw new Error('bad signature');
        added.push({ offer_id: offer.id, issuer_id: offer.issuer_id, received_at: new Date().toISOString(), credential });
      } catch {
        rejected++;
      }
    }
    if (added.length) {
      await persist({ ...wallet, credentials: [...wallet.credentials, ...added] });
      for (const c of added) if (!offers.find((o) => o.id === c.offer_id)?.claimed_at) await claimOffer(wallet.wallet_id, c.offer_id, wallet.wallet_token);
      void qc.invalidateQueries({ queryKey: ['wallet-status'] });
    }
    return { added: added.length, rejected };
  }, [wallet, persist, qc]);

  /** Breach recovery: asks the issuer to re-sign this credential with its new key; the new one arrives in the inbox. */
  const refreshCredential = useCallback(
    async (stored: StoredCredential) => {
      if (!wallet) return;
      await requestReissue(stored.issuer_id, wallet.wallet_token, {
        wallet_id: wallet.wallet_id,
        old_credential: stored.credential as SignedCredential & { type: 'Degree' | 'GovernmentId' | 'MedicalLicense' },
      });
    },
    [wallet],
  );

  const removeCredential = useCallback(
    async (offerId: string) => {
      if (wallet) await persist({ ...wallet, credentials: wallet.credentials.filter((c) => c.offer_id !== offerId) });
    },
    [wallet, persist],
  );

  const forget = useCallback(async () => {
    await forgetWallet();
    setWallet(null);
    setUnlocked(false);
  }, []);

  return { wallet, loading, unlocked, lastBackupAt, create, restore, unlock, backupNow, syncInbox, refreshCredential, removeCredential, forget };
}
