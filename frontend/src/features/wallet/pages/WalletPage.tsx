import React, { useState } from 'react';
import { Wallet, ShieldCheck, Download, Inbox, KeyRound } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';

export const WalletPage: React.FC = () => {
  // Wallet creation lands in V1-S2; until then we show the setup screen.
  const [hasWallet] = useState(false);
  const [walletId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>('');

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

        {hasWallet && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#130e24] border border-[#231a3d]">
            <span className="text-xs text-[#8ea5a8]">Wallet ID:</span>
            <Hex value={walletId || ''} prefixLen={8} suffixLen={6} />
          </div>
        )}
      </div>

      {!hasWallet ? (
        <div className="max-w-md mx-auto p-8 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#06838d]/15 text-[#79bab6] mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold text-[#f0f7f7]">Create Student Wallet</h2>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Your cryptographic keys are generated in your browser and never sent to a server. You maintain full ownership of your credentials.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#f0f7f7] block mb-1.5">Student Handle / Name</label>
              <input
                type="text"
                placeholder="e.g. alex.student"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[#f0f7f7] block mb-1.5">Backup Passphrase (min 10 characters)</label>
              <input
                type="password"
                placeholder="Enter a secure recovery passphrase"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
              />
            </div>

            <button
              type="button"
              disabled
              className="w-full py-3 rounded-xl text-sm font-medium bg-[#06838d]/40 text-white cursor-not-allowed transition-all"
            >
              Initialize Wallet (Available in V1)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Credentials Area */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">My Digital Credentials</h3>
            <EmptyState
              title="No credentials claimed yet"
              description="Your claimed student cards, degrees, and certificates will appear here."
              icon={<ShieldCheck className="w-8 h-8 text-[#79bab6]" />}
            />
          </div>

          {/* Sidebar: Inbox & Backup */}
          <div className="space-y-4">
            <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
                  <Inbox className="w-4 h-4 text-[#79bab6]" />
                  <span>Offers Inbox</span>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#231a3d] text-[#8ea5a8] font-medium">0</span>
              </div>
              <p className="text-xs text-[#8ea5a8] leading-relaxed">
                Official credential offers from your university or college will arrive here encrypted with your public key.
              </p>
            </div>

            <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
                <Download className="w-4 h-4 text-[#79bab6]" />
                <span>Encrypted Backup</span>
              </div>
              <p className="text-xs text-[#8ea5a8] leading-relaxed">
                Store an encrypted ciphertext copy using your passphrase. The server cannot read your backup.
              </p>
              <button
                type="button"
                className="w-full py-2 text-xs font-medium rounded-xl border border-[#231a3d] text-[#f0f7f7] hover:bg-[#1a1430] transition-colors cursor-pointer"
              >
                Sync Encrypted Backup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
