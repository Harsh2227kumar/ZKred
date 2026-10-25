import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, ShieldCheck, Download, Inbox, Lock, Loader2, RefreshCw, LogOut } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Loading } from '@/components/common/Loading';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import { useWalletSession } from '../hooks/useWalletSession';
import { useCredentialStatuses } from '../hooks/useCredentialStatus';
import { WalletSetup } from '../components/WalletSetup';
import { CredentialCard } from '../components/CredentialCard';

const UnlockForm: React.FC<{ onUnlock: (p: string) => Promise<void> }> = ({ onUnlock }) => {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onUnlock(pass);
          toast.success('Wallet unlocked');
        } catch (err) {
          toast.error(toUserMessage(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium text-foreground flex-1">
        <Lock className="w-4 h-4 text-amber-500" />
        Enter your passphrase to sync the inbox and back up changes.
      </div>
      <input
        type="password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        placeholder="Passphrase"
        required
        className="px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
      />
      <button type="submit" disabled={busy} className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-white disabled:opacity-50">
        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Unlock
      </button>
    </form>
  );
};

export const WalletPage: React.FC = () => {
  const session = useWalletSession();
  const { wallet, unlocked, syncInbox } = session;
  const statuses = useCredentialStatuses(wallet?.credentials ?? []);
  const [syncing, setSyncing] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const checkInbox = useCallback(
    async (quiet: boolean) => {
      setSyncing(true);
      try {
        const r = await syncInbox();
        if (r.added) toast.success(`${r.added} new credential${r.added > 1 ? 's' : ''} verified and saved`);
        if (r.rejected) toast.error(`${r.rejected} offer(s) failed signature verification and were not saved (they will not be retried)`);
        if (!quiet && !r.added && !r.rejected) toast.info('No new offers');
      } catch (err) {
        toast.error(toUserMessage(err));
      } finally {
        setSyncing(false);
      }
    },
    [syncInbox],
  );

  // Pick up new offers as soon as the wallet is unlocked.
  useEffect(() => {
    if (wallet && unlocked) void checkInbox(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet?.wallet_id, unlocked]);

  if (session.loading) return <Loading label="Opening wallet..." />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-mint" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Holder Wallet</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Credentials held only in your browser (IndexedDB), backed up encrypted.</p>
        </div>
        {wallet && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-semibold text-foreground">{wallet.display_name}</span>
            <Hex value={wallet.wallet_id} prefixLen={8} suffixLen={6} />
          </div>
        )}
      </div>

      {!wallet ? (
        <WalletSetup session={session} />
      ) : (
        <>
          {!unlocked && <UnlockForm onUnlock={session.unlock} />}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">
                My credentials ({wallet.credentials.length})
              </h3>
              {wallet.credentials.length === 0 ? (
                <EmptyState
                  title="No credentials yet"
                  description={`Ask an issuer to issue to “${wallet.display_name}”, then check your inbox.`}
                  icon={<ShieldCheck className="w-8 h-8 text-mint" />}
                />
              ) : (
                <div className="space-y-4">
                  {statuses.error && <p className="text-xs text-rose-500">Could not load credential status: {toUserMessage(statuses.error)}</p>}
                  {wallet.credentials.map((c) => (
                    <CredentialCard
                      key={c.offer_id}
                      stored={c}
                      status={statuses.data?.[c.offer_id]}
                      canRefresh={unlocked}
                      onRefresh={() => session.refreshCredential(c)}
                      onRemove={() => session.removeCredential(c.offer_id)}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="p-5 rounded-xl border border-border/60 bg-card space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Inbox className="w-4 h-4 text-mint" />
                  <span>Credential inbox</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Offers arrive encrypted to your wallet key. Each one is decrypted here and kept only if the issuer's signature verifies.
                </p>
                <button
                  type="button"
                  disabled={!unlocked || syncing}
                  onClick={() => checkInbox(false)}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Check inbox
                </button>
              </div>

              <div className="p-5 rounded-xl border border-border/60 bg-card space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Download className="w-4 h-4 text-primary" />
                  <span>Encrypted backup</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved automatically after every change (PBKDF2 → AES-GCM in this browser).
                  {session.lastBackupAt && <> Last backup: {new Date(session.lastBackupAt).toLocaleString()}.</>}
                </p>
                <button
                  type="button"
                  disabled={!unlocked}
                  onClick={() => session.backupNow().then(() => toast.success('Backup saved'), (err) => toast.error(toUserMessage(err)))}
                  className="w-full py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Back up now
                </button>
                <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs">
                  <p className="text-muted-foreground">To restore on another browser you need the wallet ID, the wallet token and your passphrase.</p>
                  <button type="button" onClick={() => setShowToken((s) => !s)} className="text-primary font-medium hover:underline">
                    {showToken ? 'Hide wallet token' : 'Show wallet token'}
                  </button>
                  {showToken && <Hex value={wallet.wallet_token} prefixLen={10} suffixLen={6} />}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (confirm('Remove this wallet from this browser? You can restore it later from the backup.')) void session.forget();
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/5"
              >
                <LogOut className="w-3.5 h-3.5" /> Remove wallet from this browser
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
