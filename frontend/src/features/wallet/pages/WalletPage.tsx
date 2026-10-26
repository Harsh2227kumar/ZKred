// frontend/src/features/wallet/pages/WalletPage.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ShieldCheck,
  Lock,
  LogOut,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { toUserMessage } from '@/api/client';
import { useIssuers } from '@/api/queries/issuers';
import { requestReissue } from '@/api/queries/wallets';
import {
  getWalletMetadata,
  getStoredCredentials,
  getReplacedCommitments,
  markCredentialReplaced,
  removeStoredCredential,
  clearWalletStore,
  type WalletMetadata,
} from '@/lib/wallet-store';
import type { SignedCredential } from '@/lib/wallet-crypto';
import { WalletSetup } from '../components/WalletSetup';
import { WalletInbox } from '../components/WalletInbox';
import { CredentialList } from '../components/CredentialList';
import { BackupModal } from '../components/BackupModal';
import { syncEncryptedBackup } from '../backup-sync';
import { credentialKey, useCredentialStatuses } from '../hooks/useCredentialStatus';

/** The API's answer when this credential was already refreshed (e.g. from another browser). */
const isAlreadyReissued = (err: unknown): boolean => {
  const e = (err as { error?: { code?: string; message?: string } })?.error;
  return e?.code === 'CONFLICT' && /already re-issued/i.test(e.message ?? '');
};

export const WalletPage: React.FC = () => {
  const [meta, setMeta] = useState<WalletMetadata | null>(null);
  const [credentials, setCredentials] = useState<SignedCredential[]>([]);
  const [replaced, setReplaced] = useState<string[]>([]);
  const [refreshingKey, setRefreshingKey] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [showBackupModal, setShowBackupModal] = useState(false);

  const queryClient = useQueryClient();
  const { data: issuersData } = useIssuers();
  const issuers = issuersData?.items || [];
  const statuses = useCredentialStatuses(credentials, replaced);

  const loadLocalWallet = useCallback(async () => {
    try {
      const storedMeta = await getWalletMetadata();
      setMeta(storedMeta);
      if (storedMeta) {
        const storedCreds = await getStoredCredentials();
        setCredentials(storedCreds);
        setReplaced(await getReplacedCommitments());
      }
    } catch (err) {
      console.error('Failed to load wallet from IndexedDB:', err);
    } finally {
      setIsInitializing(false);
    }
  }, []);

  useEffect(() => {
    loadLocalWallet();
  }, [loadLocalWallet]);

  /** Local change → encrypted backup; a locked wallet asks for the passphrase instead. */
  const backUp = async () => {
    if (!meta) return;
    try {
      if (!(await syncEncryptedBackup(meta.id, meta.wallet_token))) setShowBackupModal(true);
    } catch (err) {
      toast.error(toUserMessage(err, 'Could not update the encrypted backup.'));
    }
  };

  /**
   * Breach recovery: the issuer checks this credential against its own records and re-signs the same claims with its
   * new key. The fresh copy arrives as a normal offer in the inbox; this one is marked replaced and never presented.
   */
  const handleRefresh = async (credential: SignedCredential) => {
    const issuer = issuers.find((i) => i.did === credential.issuer_did);
    if (!meta || !issuer) return;
    const key = credentialKey(credential);
    setRefreshingKey(key);
    try {
      try {
        await requestReissue(issuer.id, meta.wallet_token, {
          wallet_id: meta.id,
          old_credential: credential as Parameters<typeof requestReissue>[2]['old_credential'],
        });
      } catch (err) {
        if (!isAlreadyReissued(err)) throw err;
      }
      setReplaced(await markCredentialReplaced(key));
      await queryClient.invalidateQueries({ queryKey: ['wallets', meta.id, 'offers'] });
      toast.success('Refresh requested', { description: `${issuer.name} re-signed it with its new key. Claim the fresh copy from your inbox.` });
      await backUp();
    } catch (err) {
      toast.error(toUserMessage(err, 'The issuer could not refresh this credential.'));
    } finally {
      setRefreshingKey(null);
    }
  };

  const handleRemove = async (credential: SignedCredential) => {
    if (!window.confirm('Remove this replaced copy from this device? Your refreshed copy is not affected.')) return;
    setCredentials(await removeStoredCredential(credentialKey(credential)));
    setReplaced(await getReplacedCommitments());
    await backUp();
  };

  const handleForgetWallet = async () => {
    if (
      window.confirm(
        'Are you sure you want to forget this wallet on this device? Ensure you have your Wallet ID, Token, and Passphrase to restore.'
      )
    ) {
      await clearWalletStore();
      setMeta(null);
      setCredentials([]);
      toast.success('Wallet removed from device memory.');
    }
  };

  if (isInitializing) {
    return <Loading label="Accessing local sovereign keys..." />;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Student Wallet</h1>
          </div>
          <p className="text-sm text-[#8ea5a8] mt-1">
            Zero-knowledge credentials held and verified exclusively on your device.
          </p>
        </div>

        {meta && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#130e24] border border-[#231a3d] text-xs">
              <span className="text-[#79bab6] font-medium">{meta.display_name}</span>
              <span className="text-[#8ea5a8]/50">•</span>
              <span className="text-[#8ea5a8]">ID:</span>
              <Hex value={meta.id} prefixLen={6} suffixLen={4} />
            </div>

            <button
              onClick={() => setShowBackupModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#231a3d] bg-[#130e24] text-xs font-medium text-[#f0f7f7] hover:bg-[#1a1430] transition-colors cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-[#79bab6]" />
              <span>Backup</span>
            </button>

            <button
              onClick={handleForgetWallet}
              title="Forget wallet on this device"
              className="p-1.5 rounded-full border border-[#231a3d] bg-[#130e24] text-[#8ea5a8] hover:text-[#ff453a] hover:bg-[#1a1430] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {!meta ? (
        <WalletSetup onWalletReady={loadLocalWallet} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Credentials Area */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">
                  My Digital Credentials
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#130e24] text-[#79bab6] border border-[#231a3d] font-medium">
                  {credentials.length}
                </span>
              </div>
              <span className="text-[11px] text-[#8ea5a8]">
                Selective disclosure ready
              </span>
            </div>

            {statuses.error && (
              <div className="p-3 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start justify-between gap-3">
                <span className="inline-flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> Could not check your credentials' status: {toUserMessage(statuses.error)}
                </span>
                <button type="button" onClick={() => statuses.refetch()} className="font-semibold underline shrink-0">
                  Retry
                </button>
              </div>
            )}

            <CredentialList
              credentials={credentials}
              issuers={issuers}
              statuses={statuses.data}
              statusUnavailable={Boolean(statuses.error) && !statuses.data}
              refreshingKey={refreshingKey}
              onRefresh={handleRefresh}
              onRemove={handleRemove}
            />
          </div>

          {/* Sidebar: Inbox & Security */}
          <div className="space-y-5">
            <WalletInbox
              walletId={meta.id}
              walletToken={meta.wallet_token}
              onClaimSuccess={loadLocalWallet}
              onRequirePassphrase={() => setShowBackupModal(true)}
            />

            {/* Privacy Guarantee Card */}
            <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6]">
                <ShieldCheck className="w-4 h-4" />
                <span>Zero-Knowledge Proof Guard</span>
              </div>
              <p className="text-xs text-[#8ea5a8] leading-relaxed">
                When presenting evidence to employers or verifiers, your browser computes BBS+ selective disclosure proofs and Circom ZK proofs without exposing your plaintext claims.
              </p>
              <div className="pt-2 border-t border-[#231a3d] flex items-center justify-between text-[11px] text-[#8ea5a8]">
                <span>Storage:</span>
                <span className="font-mono text-[#79bab6]">IndexedDB (Client)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Backup Sync Modal */}
      {meta && (
        <BackupModal
          isOpen={showBackupModal}
          onClose={() => setShowBackupModal(false)}
          walletId={meta.id}
          walletToken={meta.wallet_token}
        />
      )}
    </div>
  );
};
