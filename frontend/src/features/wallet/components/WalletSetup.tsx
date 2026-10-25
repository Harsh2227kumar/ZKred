import React, { useState } from 'react';
import { toast } from 'sonner';
import { KeyRound, Loader2 } from 'lucide-react';
import { toUserMessage } from '@/api/client';
import { MIN_PASSPHRASE_LENGTH, type useWalletSession } from '../hooks/useWalletSession';

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-hidden';

type Session = ReturnType<typeof useWalletSession>;

/** First visit: create a new browser wallet, or restore one from its encrypted server backup. */
export const WalletSetup: React.FC<{ session: Session }> = ({ session }) => {
  const [mode, setMode] = useState<'create' | 'restore'>('create');
  const [displayName, setDisplayName] = useState('');
  const [walletId, setWalletId] = useState('');
  const [token, setToken] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'create') {
        await session.create(displayName.trim(), passphrase);
        toast.success('Wallet created', { description: 'Your keys never leave this browser.' });
      } else {
        await session.restore(walletId.trim(), token.trim(), passphrase);
        toast.success('Wallet restored from the encrypted backup');
      }
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 mx-auto flex items-center justify-center">
          <KeyRound className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Set up your ZK wallet</h2>
        <p className="text-xs text-muted-foreground">
          Keys are generated with WebCrypto and stored in this browser. The server only ever sees ciphertext.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/60 text-xs font-medium">
        {(['create', 'restore'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`py-1.5 rounded-md ${mode === m ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground'}`}
          >
            {m === 'create' ? 'Create new' : 'Restore backup'}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-4">
        {mode === 'create' ? (
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">Display name (issuers find you by it)</span>
            <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={60} required />
          </label>
        ) : (
          <>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">Wallet ID</span>
              <input className={`${inputClass} font-mono`} value={walletId} onChange={(e) => setWalletId(e.target.value)} required />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">Wallet token</span>
              <input className={`${inputClass} font-mono`} type="password" value={token} onChange={(e) => setToken(e.target.value)} required />
            </label>
          </>
        )}
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Passphrase (min {MIN_PASSPHRASE_LENGTH} characters)</span>
          <input
            className={inputClass}
            type="password"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            minLength={MIN_PASSPHRASE_LENGTH}
            required
          />
          <span className="text-[11px] text-muted-foreground">Encrypts your backup in the browser. It is never sent anywhere.</span>
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold bg-violet-600 text-white hover:bg-violet-600/90 disabled:opacity-50"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />}
          {mode === 'create' ? 'Create browser wallet' : 'Restore wallet'}
        </button>
      </form>
    </div>
  );
};
