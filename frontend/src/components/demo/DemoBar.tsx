// frontend/src/components/demo/DemoBar.tsx
// Interactive Demo Journey Stepper & 1-Click Persona Quick-Switcher
import React, { useState, useEffect } from 'react';
import { useLocation, NavLink } from 'react-router-dom';
import {
  Sparkles,
  Building2,
  Wallet,
  CheckCircle2,
  Flame,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldCheck,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getWalletMetadata,
  clearWalletStore,
  restoreWalletState,
  setSessionPassphrase,
  type WalletMetadata,
} from '@/lib/wallet-store';
import { decryptWalletBackup } from '@/lib/wallet-crypto';
import { adminToken } from '@/api/client';
import { config } from '@/config';

interface DemoPersona {
  displayName: string;
  fullName: string;
  role: string;
  description: string;
}

const DEMO_PERSONAS: DemoPersona[] = [
  {
    displayName: 'asha',
    fullName: 'Dr. Asha Sharma',
    role: 'Honest Doctor',
    description: 'Pre-seeded with AIIMS MBBS Degree & Government ID.',
  },
  {
    displayName: 'meera',
    fullName: 'Dr. Meera Deshpande',
    role: 'In-Window Doctor',
    description: 'Credential falls inside the breach window; tests 1-click refresh.',
  },
  {
    displayName: 'rohan',
    fullName: 'Rohan Kulkarni',
    role: 'Resident Candidate',
    description: 'Graduate applicant for residency onboarding.',
  },
];

const STORY_STEPS = [
  {
    id: 1,
    path: '/issuer',
    label: '1. Issue & Anchor',
    role: 'Registrar',
    desc: 'MMC signs degree with BBS+ and anchors batch on-chain',
    icon: Building2,
  },
  {
    id: 2,
    path: '/wallet',
    label: '2. Claim in Wallet',
    role: 'Asha (Holder)',
    desc: 'Decrypts offer into client-side IndexedDB wallet',
    icon: Wallet,
  },
  {
    id: 3,
    path: '/verifier',
    label: '3. AI Verifier',
    role: 'Apollo Hospital',
    desc: 'Bedrock compiles NL query into ZK presentation policy',
    icon: CheckCircle2,
  },
  {
    id: 4,
    path: '/attack',
    label: '4. Breach Pipeline',
    role: 'Attacker',
    desc: 'Steals BBS key & forges degrees in an open batch',
    icon: Flame,
  },
  {
    id: 5,
    path: '/attack',
    label: '5. The On-Chain Flip',
    role: 'Registrar & Verifier',
    desc: 'Compromise cutoff quarantines forgeries; legacy degrees hold',
    icon: ShieldCheck,
  },
];

export const DemoBar: React.FC = () => {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem('zkred_demobar_collapsed') === 'true';
  });
  const [activeWallet, setActiveWallet] = useState<WalletMetadata | null>(null);
  const [hasAdmin, setHasAdmin] = useState(() => Boolean(adminToken.get()));
  const [showPersonaDialog, setShowPersonaDialog] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<DemoPersona | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [passphraseInput, setPassphraseInput] = useState(() => config.demoWalletPassphrase || '');
  const [isRestoring, setIsRestoring] = useState(false);

  const refreshWalletState = async () => {
    try {
      const meta = await getWalletMetadata();
      setActiveWallet(meta);
    } catch {
      setActiveWallet(null);
    }
  };

  useEffect(() => {
    refreshWalletState();
    const interval = setInterval(refreshWalletState, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('zkred_demobar_collapsed', String(next));
  };

  // Determine active step from pathname
  const currentStep = (() => {
    const p = location.pathname;
    if (p.startsWith('/issuer')) return 1;
    if (p.startsWith('/wallet/respond')) return 3;
    if (p.startsWith('/wallet')) return 2;
    if (p.startsWith('/verifier')) return 3;
    if (p.startsWith('/attack')) return 4;
    return 0;
  })();

  const handleOpenPersonaDialog = (persona: DemoPersona) => {
    setSelectedPersona(persona);
    // Check if token was previously saved for this persona in localStorage
    const savedToken = localStorage.getItem(`zkred_token_${persona.displayName}`) || '';
    setTokenInput(savedToken);
    setShowPersonaDialog(true);
  };

  const handleRestorePersona = async () => {
    if (!selectedPersona) return;
    setIsRestoring(true);

    try {
      // 1. Lookup wallet ID by display name from API
      const lookupRes = await fetch(
        `${config.apiBaseUrl}/wallets/lookup?display_name=${encodeURIComponent(selectedPersona.displayName)}`
      );
      if (!lookupRes.ok) {
        throw new Error(
          `Wallet "${selectedPersona.displayName}" not found in database. Run "pnpm --filter scripts seed" first.`
        );
      }
      const walletLookup = await lookupRes.json();
      const walletId = walletLookup.id;

      // 2. We need the wallet token to pull the encrypted backup
      const token = tokenInput.trim();
      if (!token) {
        throw new Error(
          `Wallet token required to decrypt ${selectedPersona.fullName}'s backup. Check your seed console output or paste it below.`
        );
      }

      // 3. Fetch encrypted backup
      const backupRes = await fetch(`${config.apiBaseUrl}/wallets/${walletId}/backup`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!backupRes.ok) {
        throw new Error('Could not fetch wallet backup from server. Verify the wallet token.');
      }
      const backupData = await backupRes.json();

      // 4. Decrypt using recovery passphrase
      const pass = passphraseInput.trim();
      if (!pass) {
        throw new Error('Recovery passphrase required to decrypt wallet backup.');
      }
      const decrypted = (await decryptWalletBackup(pass, backupData)) as any;

      // 5. Restore into IndexedDB
      await restoreWalletState(decrypted);
      setSessionPassphrase(pass);

      // Save token in localStorage for 1-click restore later
      localStorage.setItem(`zkred_token_${selectedPersona.displayName}`, token);

      toast.success(`Switched active wallet to ${selectedPersona.fullName}!`);
      setShowPersonaDialog(false);
      await refreshWalletState();
      // Reload page if already on wallet to trigger re-render
      if (location.pathname.startsWith('/wallet')) {
        window.location.reload();
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to switch demo persona.');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleClearWallet = async () => {
    if (window.confirm('Reset current wallet session in browser memory?')) {
      await clearWalletStore();
      setActiveWallet(null);
      toast.success('Wallet session cleared.');
      if (location.pathname.startsWith('/wallet')) {
        window.location.reload();
      }
    }
  };

  return (
    <>
      <div className="w-full bg-linear-to-r from-[#130e24] via-[#1a1430] to-[#130e24] border-b border-[#231a3d] text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#06838d]/20 text-[#79bab6] font-semibold text-[10px] uppercase tracking-wider border border-[#06838d]/30">
                <Sparkles className="w-3 h-3" />
                Demo Guide
              </span>
              <span className="hidden sm:inline text-[#8ea5a8] text-[11px]">
                5-Step Hackathon Walkthrough & Sovereign Persona Switcher
              </span>
            </div>

            {/* Quick Actions & Collapse Toggle */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Active Persona Pill */}
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#090614] border border-[#231a3d] text-[11px]">
                <UserCheck className="w-3.5 h-3.5 text-[#79bab6]" />
                <span className="text-[#8ea5a8]">Active:</span>
                <span className="font-medium text-[#f0f7f7]">
                  {activeWallet ? activeWallet.display_name : 'No Wallet'}
                </span>
                {activeWallet && (
                  <button
                    type="button"
                    onClick={handleClearWallet}
                    title="Disconnect wallet"
                    className="ml-1 text-[#8ea5a8] hover:text-[#ff453a] transition-colors"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Admin Token Pill */}
              <button
                type="button"
                onClick={() => {
                  if (hasAdmin) {
                    if (window.confirm('Clear stored registrar admin token?')) {
                      adminToken.set('');
                      setHasAdmin(false);
                      toast.success('Admin token cleared.');
                    }
                  } else {
                    const entered = window.prompt('Enter registrar admin token:');
                    if (entered?.trim()) {
                      adminToken.set(entered.trim());
                      setHasAdmin(true);
                      toast.success('Admin token active!');
                    }
                  }
                }}
                className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[10px] font-medium border transition-colors ${
                  hasAdmin
                    ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/30 hover:bg-[#10b981]/25'
                    : 'bg-[#ff9f0a]/15 text-[#ff9f0a] border-[#ff9f0a]/30 hover:bg-[#ff9f0a]/25'
                }`}
                title={hasAdmin ? 'Admin Token Active (Click to clear)' : 'No Admin Token (Click to enter)'}
              >
                <KeyRound className="w-3 h-3" />
                <span>{hasAdmin ? 'Admin 🔐' : 'No Admin 🔓'}</span>
              </button>

              {/* Persona Quick Switch Dropdown trigger */}
              <div className="flex items-center gap-1">
                {DEMO_PERSONAS.map((p) => (
                  <button
                    key={p.displayName}
                    type="button"
                    onClick={() => handleOpenPersonaDialog(p)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                      activeWallet?.display_name === p.displayName
                        ? 'bg-[#06838d]/30 text-[#79bab6] border-[#06838d]/50'
                        : 'bg-[#090614] text-[#8ea5a8] border-[#231a3d] hover:text-[#f0f7f7] hover:border-[#79bab6]/40'
                    }`}
                    title={p.description}
                  >
                    {p.fullName.split(' ')[1] || p.displayName}
                  </button>
                ))}
              </div>

              {/* Collapse/Expand Toggle */}
              <button
                type="button"
                onClick={toggleCollapsed}
                className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] hover:bg-[#090614] border border-transparent hover:border-[#231a3d] transition-colors"
                title={collapsed ? 'Show Story Guide' : 'Minimize Story Guide'}
              >
                {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Expanded Stepper */}
          {!collapsed && (
            <div className="pt-2.5 pb-1 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 border-t border-[#231a3d]/60 mt-2">
              {STORY_STEPS.map((s) => {
                const Icon = s.icon;
                const isCurrent = currentStep === s.id;
                return (
                  <NavLink
                    key={s.id}
                    to={s.path}
                    className={`p-2.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isCurrent
                        ? 'bg-[#06838d]/15 border-[#06838d]/50 text-[#f0f7f7] shadow-xs'
                        : 'bg-[#090614]/60 border-[#231a3d] text-[#8ea5a8] hover:text-[#f0f7f7] hover:border-[#79bab6]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#79bab6]">
                        {s.role}
                      </span>
                      <Icon className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#79bab6]' : 'text-[#8ea5a8]'}`} />
                    </div>
                    <div className="text-[11px] font-medium leading-tight text-[#f0f7f7] truncate">
                      {s.label}
                    </div>
                    <p className="text-[10px] text-[#8ea5a8] mt-1 line-clamp-1 leading-normal">
                      {s.desc}
                    </p>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Restore Persona Modal */}
      {showPersonaDialog && selectedPersona && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="max-w-md w-full p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
                <UserCheck className="w-4.5 h-4.5 text-[#79bab6]" />
                <span>Load Demo Persona: {selectedPersona.fullName}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPersonaDialog(false)}
                className="text-[#8ea5a8] hover:text-[#f0f7f7]"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              {selectedPersona.description} This will decrypt and rehydrate {selectedPersona.fullName}'s sovereign keys and BBS+ credentials into this device's IndexedDB.
            </p>

            <div className="p-3 rounded-2xl bg-[#090614] border border-[#231a3d] space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-[#8ea5a8]">Handle:</span>
                <span className="font-mono text-[#79bab6]">{selectedPersona.displayName}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#f0f7f7]">
                Recovery Passphrase
              </label>
              <input
                type="password"
                placeholder="Enter recovery passphrase"
                value={passphraseInput}
                onChange={(e) => setPassphraseInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#231a3d] bg-[#090614] text-xs text-[#f0f7f7] focus:outline-hidden focus:border-[#06838d]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-[#f0f7f7]">
                Wallet Bearer Token
              </label>
              <input
                type="password"
                placeholder="Paste token (shown when running pnpm seed)"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-[#231a3d] bg-[#090614] text-xs text-[#f0f7f7] font-mono focus:outline-hidden focus:border-[#06838d]"
              />
              <p className="text-[10px] text-[#8ea5a8]">
                Tokens are printed in your terminal upon seeding. Once entered, your browser remembers it locally.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#231a3d]">
              <button
                type="button"
                onClick={() => setShowPersonaDialog(false)}
                className="px-3.5 py-2 rounded-xl text-xs text-[#8ea5a8] hover:text-[#f0f7f7]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={handleRestorePersona}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#06838d] hover:bg-[#046168] text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
              >
                {isRestoring ? 'Decrypting & Loading...' : 'Switch to this Persona'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
