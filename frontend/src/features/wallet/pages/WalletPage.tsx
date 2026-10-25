import { useState } from 'react';
import { Wallet, ShieldCheck, Download, Inbox, KeyRound } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';

export const WalletPage: React.FC = () => {
  // Wallet creation (POST /wallets + zk-core walletCrypto + IndexedDB) lands in V1-S2; until then there is no wallet.
  const [hasWallet] = useState(false);
  const [walletId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="w-6 h-6 text-violet-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Holder Wallet</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Zero-knowledge credentials held exclusively in your browser (IndexedDB).
          </p>
        </div>

        {hasWallet && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">Wallet ID:</span>
            <Hex value={walletId || ''} prefixLen={8} suffixLen={6} />
          </div>
        )}
      </div>

      {!hasWallet ? (
        <div className="max-w-md mx-auto p-8 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Setup Your ZK Wallet</h2>
            <p className="text-xs text-muted-foreground">
              Your cryptographic keys are generated in WebCrypto and stored client-side. The server never learns your private keys or claims.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Display Name</label>
              <input
                type="text"
                placeholder="Name issuers will look you up by"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-foreground block mb-1">Passphrase (min 10 characters)</label>
              <input
                type="password"
                placeholder="Passphrase for client-side encrypted backup"
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:ring-2 focus:ring-violet-500 focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              disabled
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-violet-600/40 text-white cursor-not-allowed shadow-xs"
            >
              Create Browser Wallet (arrives in V1)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Credentials Area */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">My Credentials</h3>
            <EmptyState
              title="No credentials claimed yet"
              description="Check your inbox on the right for incoming credential offers from issuers."
              icon={<ShieldCheck className="w-8 h-8 text-violet-500" />}
            />
          </div>

          {/* Sidebar: Inbox & Backup */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl border border-border/60 bg-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Inbox className="w-4 h-4 text-violet-500" />
                  <span>Credential Inbox</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500 font-semibold font-mono">0</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Incoming offers from universities and medical councils arrive here encrypted with your wallet public key.
              </p>
            </div>

            <div className="p-5 rounded-xl border border-border/60 bg-card space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <Download className="w-4 h-4 text-primary" />
                <span>Encrypted Backup</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Synced to server as AES-GCM encrypted ciphertext. Only your passphrase can decrypt it.
              </p>
              <button
                type="button"
                className="w-full py-2 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-colors cursor-pointer"
              >
                Sync Encrypted Backup Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
