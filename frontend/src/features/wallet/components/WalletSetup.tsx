// frontend/src/features/wallet/components/WalletSetup.tsx
import React, { useState } from 'react';
import { KeyRound, Sparkles, DownloadCloud, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateWallet } from '@/api/queries/wallets';
import {
  generateWalletKeyPair,
  encryptWalletBackup,
  decryptWalletBackup,
} from '@/lib/wallet-crypto';
import {
  saveWalletMetadata,
  saveWalletKeypair,
  setSessionPassphrase,
  restoreWalletState,
  type FullWalletBackupState,
} from '@/lib/wallet-store';
import { toUserMessage } from '@/api/client';
import { config } from '@/config';

interface WalletSetupProps {
  onWalletReady: () => void;
}

export const WalletSetup: React.FC<WalletSetupProps> = ({ onWalletReady }) => {
  const [tab, setTab] = useState<'create' | 'restore'>('create');

  // Create Form State
  const [displayName, setDisplayName] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');

  // Restore Form State
  const [restoreWalletId, setRestoreWalletId] = useState('');
  const [restoreToken, setRestoreToken] = useState('');
  const [restorePassphrase, setRestorePassphrase] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useCreateWallet();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = displayName.trim();
    if (cleanName.length < 2 || cleanName.length > 60) {
      setErrorMsg('Display name must be between 2 and 60 characters.');
      return;
    }

    if (passphrase.length < 10) {
      setErrorMsg('Passphrase must be at least 10 characters long.');
      return;
    }

    if (passphrase !== confirmPassphrase) {
      setErrorMsg('Passphrases do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Generate client-side ECDH P-256 keypair
      const keypair = await generateWalletKeyPair();

      // 2. Register on server
      const created = await createMutation.mutateAsync({
        display_name: cleanName,
        enc_public_key: keypair.publicKeyB64,
      });

      // 3. Save to IndexedDB
      const meta = {
        id: created.id,
        display_name: created.display_name,
        wallet_token: created.wallet_token,
      };
      await saveWalletMetadata(meta);
      await saveWalletKeypair(keypair);
      setSessionPassphrase(passphrase);

      // 4. Create initial encrypted backup
      const backupPayload: FullWalletBackupState = {
        version: 1,
        metadata: meta,
        keypair,
        credentials: [],
        exported_at: new Date().toISOString(),
      };
      const encrypted = await encryptWalletBackup(passphrase, backupPayload);
      await fetch(`${config.apiBaseUrl}/wallets/${created.id}/backup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${created.wallet_token}`,
        },
        body: JSON.stringify({
          ...encrypted,
          version: 1,
        }),
      });

      toast.success(`Wallet created! Sovereign keys stored on your device.`);
      onWalletReady();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to create student wallet.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanId = restoreWalletId.trim();
    const cleanToken = restoreToken.trim();

    if (!cleanId || !cleanToken || !restorePassphrase) {
      setErrorMsg('Please fill in Wallet ID, Wallet Token, and Passphrase.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Fetch encrypted backup
      const res = await fetch(`${config.apiBaseUrl}/wallets/${cleanId}/backup`, {
        headers: { Authorization: `Bearer ${cleanToken}` },
      });

      if (!res.ok) {
        throw await res.json().catch(() => ({ error: { message: 'Backup not found' } }));
      }

      const backup = await res.json();

      // 2. Decrypt backup with passphrase
      const decrypted = (await decryptWalletBackup(
        restorePassphrase,
        backup
      )) as FullWalletBackupState;

      // 3. Rehydrate IndexedDB
      await restoreWalletState(decrypted);
      setSessionPassphrase(restorePassphrase);

      toast.success(`Wallet restored! Loaded ${decrypted.credentials?.length || 0} credentials.`);
      onWalletReady();
    } catch (err: any) {
      if (err?.code === 'BAD_PASSPHRASE' || err?.message?.includes('BAD_PASSPHRASE')) {
        setErrorMsg('Incorrect passphrase. Could not decrypt wallet backup.');
      } else {
        setErrorMsg(toUserMessage(err, 'Failed to restore wallet. Check your Wallet ID and token.'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 rounded-3xl border border-[#231a3d] bg-[#130e24] shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-[#06838d]/15 text-[#79bab6] mx-auto flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-[#f0f7f7]">Self-Sovereign Student Wallet</h2>
        <p className="text-xs text-[#8ea5a8] leading-relaxed">
          Keys and credentials reside only on your device. The server holds zero plaintext identity data.
        </p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#090614] border border-[#231a3d]">
        <button
          type="button"
          onClick={() => {
            setTab('create');
            setErrorMsg(null);
          }}
          className={`py-2 text-xs font-medium rounded-xl transition-all ${
            tab === 'create'
              ? 'bg-[#1a1430] text-[#f0f7f7] shadow-xs'
              : 'text-[#8ea5a8] hover:text-[#f0f7f7]'
          }`}
        >
          Create New
        </button>
        <button
          type="button"
          onClick={() => {
            setTab('restore');
            setErrorMsg(null);
          }}
          className={`py-2 text-xs font-medium rounded-xl transition-all ${
            tab === 'restore'
              ? 'bg-[#1a1430] text-[#f0f7f7] shadow-xs'
              : 'text-[#8ea5a8] hover:text-[#f0f7f7]'
          }`}
        >
          Restore Backup
        </button>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {tab === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Student Handle / Display Name</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={60}
              placeholder="e.g. asha_sharma"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
            />
            <p className="text-[11px] text-[#8ea5a8]">Used by institutions to lookup your wallet public key.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Backup Passphrase (min 10 chars)</label>
            <input
              type="password"
              required
              minLength={10}
              placeholder="Enter recovery passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Confirm Passphrase</label>
            <input
              type="password"
              required
              minLength={10}
              placeholder="Re-enter recovery passphrase"
              value={confirmPassphrase}
              onChange={(e) => setConfirmPassphrase(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#06838d] to-[#014f85] text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Keys & Initializing...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Initialize Sovereign Wallet</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <form onSubmit={handleRestore} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Wallet ID (UUID)</label>
            <input
              type="text"
              required
              placeholder="Paste your wallet UUID"
              value={restoreWalletId}
              onChange={(e) => setRestoreWalletId(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Wallet Token</label>
            <input
              type="password"
              required
              placeholder="Paste your bearer wallet token"
              value={restoreToken}
              onChange={(e) => setRestoreToken(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">Recovery Passphrase</label>
            <input
              type="password"
              required
              placeholder="Enter recovery passphrase"
              value={restorePassphrase}
              onChange={(e) => setRestorePassphrase(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#06838d] to-[#014f85] text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Decrypting & Restoring...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-4 h-4" />
                <span>Restore Wallet from Backup</span>
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
};
