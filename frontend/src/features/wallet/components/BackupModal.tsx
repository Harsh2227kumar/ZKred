// frontend/src/features/wallet/components/BackupModal.tsx
import React, { useState } from 'react';
import { X, Lock, Download, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { encryptWalletBackup } from '@/lib/wallet-crypto';
import {
  setSessionPassphrase,
  getFullWalletState,
} from '@/lib/wallet-store';
import { toUserMessage } from '@/api/client';
import { config } from '@/config';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletId: string;
  walletToken: string;
}

export const BackupModal: React.FC<BackupModalProps> = ({
  isOpen,
  onClose,
  walletId,
  walletToken,
}) => {
  const [passphrase, setPassphrase] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSyncBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (passphrase.length < 10) {
      setErrorMsg('Passphrase must be at least 10 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      const fullState = await getFullWalletState();
      if (!fullState) throw new Error('No local wallet found to backup.');

      const encrypted = await encryptWalletBackup(passphrase, fullState);
      const res = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/backup`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${walletToken}`,
        },
        body: JSON.stringify({ ...encrypted, version: 1 }),
      });

      if (!res.ok) {
        throw await res.json().catch(() => ({ error: { message: 'Backup upload failed' } }));
      }

      setSessionPassphrase(passphrase);
      toast.success('Encrypted backup successfully updated on server!');
      onClose();
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to encrypt and sync backup.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportJson = async () => {
    try {
      const fullState = await getFullWalletState();
      if (!fullState) return;

      const blob = new Blob([JSON.stringify(fullState, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zkred-wallet-${walletId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Local backup exported.');
    } catch (err) {
      toast.error('Failed to export wallet data.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#231a3d]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-[#f0f7f7]">Encrypted Wallet Backup</h2>
              <p className="text-xs text-[#8ea5a8]">PBKDF2-SHA256 (100k) + AES-256-GCM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] hover:bg-[#1a1430] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSyncBackup} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#f0f7f7] block">
              Enter Recovery Passphrase
            </label>
            <input
              type="password"
              required
              minLength={10}
              placeholder="Your backup recovery passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8]/50 focus:border-[#06838d] focus:outline-hidden"
              autoFocus
            />
            <p className="text-[11px] text-[#8ea5a8]">
              Encrypts your credentials before sending to the server. The server never learns your passphrase.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[#79bab6] hover:bg-[#06838d]/15 transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> Export JSON
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#231a3d] bg-[#1a1430] text-xs font-medium text-[#f0f7f7] hover:bg-[#231a3d] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 disabled:opacity-50 transition-all shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Encrypting...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Sync Backup</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
