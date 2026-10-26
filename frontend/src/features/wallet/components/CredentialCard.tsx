// frontend/src/features/wallet/components/CredentialCard.tsx
import React, { useState } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  Eye,
  EyeOff,
  Lock,
  FileBadge,
  UserCheck,
  AlertTriangle,
  Ban,
  Clock,
  Loader2,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
} from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import type { SignedCredential } from '@/lib/wallet-crypto';
import { displayFields } from '@/lib/zk';
import type { Issuer } from '@/api/schemas';
import type { CredentialStatus } from '../hooks/useCredentialStatus';

interface CredentialCardProps {
  credential: SignedCredential;
  issuer?: Issuer;
  /** Undefined while the live status is loading or when it could not be read (`statusUnavailable`). */
  status?: CredentialStatus;
  statusUnavailable?: boolean;
  /** Breach recovery: ask the issuer to re-sign this credential with its new key. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Drops a replaced copy from this device. */
  onRemove?: () => void;
}

/** One line per status: what it means for the holder and, when there is one, what to do. */
const StatusBanner: React.FC<Pick<CredentialCardProps, 'status' | 'statusUnavailable' | 'onRefresh' | 'refreshing' | 'onRemove'>> = ({
  status,
  statusUnavailable,
  onRefresh,
  refreshing,
  onRemove,
}) => {
  if (!status && statusUnavailable) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#090614]/70 border border-white/5 text-[11px] text-[#8ea5a8]">
        <AlertTriangle className="w-3.5 h-3.5 text-[#ff9f0a]" /> Status unknown: the revocation list and key status could not be read right now
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#090614]/70 border border-white/5 text-[11px] text-[#8ea5a8]">
        <Loader2 className="w-3.5 h-3.5 animate-spin text-[#79bab6]" /> Checking revocation list and key status on-chain…
      </div>
    );
  }
  const base = 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border text-xs';
  switch (status.kind) {
    case 'active':
      return (
        <div className={`${base} bg-[#06838d]/15 border-[#06838d]/40 text-[#79bab6]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0 text-[#10b981]" /> Active: verified on-chain & accepted{status.note ? `. ${status.note}` : ''}
          </span>
        </div>
      );
    case 'pending_anchor':
      return (
        <div className={`${base} bg-[#ff9f0a]/15 border-[#ff9f0a]/30 text-[#ff9f0a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 shrink-0" /> Waiting for the issuer to anchor its batch on-chain
          </span>
        </div>
      );
    case 'revoked':
      return (
        <div className={`${base} bg-[#ff453a]/15 border-[#ff453a]/30 text-[#ff453a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Ban className="w-4 h-4 shrink-0" /> Revoked by the issuer: verifiers reject it
          </span>
        </div>
      );
    case 'needs_refresh':
      return (
        <div className={`${base} bg-[#ff9f0a]/15 border-[#ff9f0a]/30 text-[#ff9f0a]`}>
          <span className="inline-flex items-start gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff9f0a]" /> {status.reason}. Verifiers reject it until you refresh it.
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff9f0a] text-[#090614] font-semibold whitespace-nowrap hover:bg-[#ff9f0a]/90 disabled:opacity-60 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {refreshing ? 'Requesting…' : 'Refresh credential'}
            </button>
          )}
        </div>
      );
    case 'replaced':
      return (
        <div className={`${base} bg-[#1a1430] border-[#231a3d] text-[#8ea5a8]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <RefreshCw className="w-4 h-4 shrink-0" /> Replaced: fresh copy signed with issuer's new key is in your inbox
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#231a3d] text-[#f0f7f7] whitespace-nowrap hover:bg-[#231a3d] cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" /> Remove old copy
            </button>
          )}
        </div>
      );
    case 'invalid':
      return (
        <div className={`${base} bg-[#ff453a]/15 border-[#ff453a]/30 text-[#ff453a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Not verifiable: {status.reason}
          </span>
        </div>
      );
  }
};

const CARD_THEMES = {
  Degree: {
    cardClass: 'border-[#1e3a8a]/50 bg-linear-to-br from-[#0c1430] via-[#121f47] to-[#0c1430]',
    badgeClass: 'bg-[#1e3a8a]/40 text-[#93c5fd] border-[#3b82f6]/40',
    icon: GraduationCap,
    headerColor: 'text-[#93c5fd]',
    foilGlow: 'shadow-blue-900/10',
  },
  MedicalLicense: {
    cardClass: 'border-[#06838d]/50 bg-linear-to-br from-[#061f1c] via-[#0a3530] to-[#061f1c]',
    badgeClass: 'bg-[#06838d]/30 text-[#79bab6] border-[#06838d]/50',
    icon: FileBadge,
    headerColor: 'text-[#79bab6]',
    foilGlow: 'shadow-teal-900/10',
  },
  GovernmentId: {
    cardClass: 'border-[#b45309]/50 bg-linear-to-br from-[#21160a] via-[#33210d] to-[#21160a]',
    badgeClass: 'bg-[#b45309]/30 text-[#fcd34d] border-[#b45309]/40',
    icon: UserCheck,
    headerColor: 'text-[#fcd34d]',
    foilGlow: 'shadow-amber-900/10',
  },
};

export const CredentialCard: React.FC<CredentialCardProps> = ({
  credential,
  issuer,
  status,
  statusUnavailable,
  onRefresh,
  refreshing,
  onRemove,
}) => {
  const [showPii, setShowPii] = useState(false);
  const [showCrypto, setShowCrypto] = useState(false);

  const credType = credential.type as keyof typeof CARD_THEMES;
  const theme = CARD_THEMES[credType] || CARD_THEMES.Degree;
  const WatermarkIcon = theme.icon;
  const values = credential.values || {};

  // Issuer key status check
  const activeKey = issuer?.keys?.find((k) => k.key_id === credential.key_id);

  return (
    <div
      className={`relative p-6 sm:p-7 rounded-3xl border ${theme.cardClass} hover:border-white/20 transition-all space-y-5 shadow-xl ${theme.foilGlow} overflow-hidden`}
    >
      {/* Background Watermark Seal */}
      <WatermarkIcon className="absolute -right-6 -bottom-6 w-48 h-48 opacity-[0.04] pointer-events-none text-white" />

      {/* Top Header: EMV Chip + Type Badge + PII Toggle */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-3.5">
          {/* Tactile EMV Security Chip */}
          <div className="w-10 h-7 rounded-lg bg-linear-to-tr from-amber-300/30 via-amber-200/50 to-amber-300/20 border border-amber-300/40 flex items-center justify-center relative overflow-hidden shadow-xs">
            <div className="w-6 h-4 border border-amber-300/50 rounded-xs flex items-center justify-center">
              <div className="w-3 h-full border-r border-amber-300/50" />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className={`text-base font-bold tracking-tight text-white`}>{credential.type}</h3>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-full border ${theme.badgeClass}`}>
                BBS+ Signed
              </span>
            </div>
            <p className="text-xs text-[#8ea5a8] mt-0.5">
              Issued by <strong className="text-[#f0f7f7]">{issuer?.name || credential.issuer_did}</strong>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowPii(!showPii)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-[#090614]/80 hover:bg-[#1a1430] text-[11px] font-medium text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors cursor-pointer shadow-xs"
        >
          {showPii ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-[#ff9f0a]" />
              <span>Hide Private Claims</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-[#79bab6]" />
              <span>Show on this Device</span>
            </>
          )}
        </button>
      </div>

      <StatusBanner
        status={status}
        statusUnavailable={statusUnavailable}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onRemove={onRemove}
      />

      {/* Claims Grid: the layout's claim fields in sleek inset cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 relative z-10">
        {displayFields(credential).map((f) => (
          <div key={f.name} className="p-3.5 rounded-2xl bg-[#090614]/75 border border-white/10 space-y-1 backdrop-blur-xs">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8ea5a8]">
              <span>{f.label}</span>
              {f.pii && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#79bab6]">
                  <Lock className="w-2.5 h-2.5" /> PII
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[#f0f7f7] break-words">
              {f.pii && !showPii ? (
                <span className="tracking-widest text-[#8ea5a8]/70 select-none">••••••••</span>
              ) : (
                <span>{f.value}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Technical Evidence Footer with Cryptography Inspector Drawer */}
      <div className="pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#8ea5a8] relative z-10">
        <div className="flex items-center gap-2">
          <span>Key Epoch:</span>
          <Hex value={credential.key_id} prefixLen={6} suffixLen={4} />
          {activeKey?.status === 'active' ? (
            <span className="inline-flex items-center gap-1 text-[#10b981]">
              <ShieldCheck className="w-3 h-3" /> Valid
            </span>
          ) : activeKey?.status === 'compromised' ? (
            <span className="inline-flex items-center gap-1 text-[#fb7185]">
              <AlertTriangle className="w-3 h-3" /> Compromised
            </span>
          ) : activeKey?.status === 'rotated' ? (
            <span className="text-[#ff9f0a]">Rotated</span>
          ) : (
            <span className="text-[#8ea5a8]">Unknown</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowCrypto(!showCrypto)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] hover:text-white transition-colors"
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{showCrypto ? 'Hide Crypto Details' : 'Inspect Cryptography'}</span>
          {showCrypto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
      </div>

      {/* Cryptography Inspector Drawer */}
      {showCrypto && (
        <div className="p-4 rounded-2xl bg-[#090614]/90 border border-white/10 text-xs space-y-2.5 animate-in fade-in duration-150 relative z-10">
          <div className="flex items-center gap-2 text-[#79bab6] font-semibold text-[11px] uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5" />
            <span>Cryptographic Primitives & On-Chain Commitments</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
            {values.commitment && (
              <div className="p-2 rounded-xl bg-[#130e24] border border-[#231a3d]">
                <span className="block text-[10px] text-[#8ea5a8] uppercase font-sans">Poseidon Commitment</span>
                <span className="text-[#f0f7f7] truncate block" title={values.commitment}>
                  {values.commitment}
                </span>
              </div>
            )}
            {values.batch_id && (
              <div className="p-2 rounded-xl bg-[#130e24] border border-[#231a3d]">
                <span className="block text-[10px] text-[#8ea5a8] uppercase font-sans">Merkle Batch ID</span>
                <Hex value={values.batch_id} prefixLen={8} suffixLen={6} />
              </div>
            )}
            <div className="p-2 rounded-xl bg-[#130e24] border border-[#231a3d]">
              <span className="block text-[10px] text-[#8ea5a8] uppercase font-sans">BLS12-381 G2 Key ID</span>
              <Hex value={credential.key_id} prefixLen={8} suffixLen={6} />
            </div>
            {values.status_index !== undefined && (
              <div className="p-2 rounded-xl bg-[#130e24] border border-[#231a3d]">
                <span className="block text-[10px] text-[#8ea5a8] uppercase font-sans">Status List Slot</span>
                <span className="text-[#f0f7f7]">Bit Index #{values.status_index}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-[#8ea5a8] leading-relaxed">
            Signed with BLS12-381 G2 curve pairing. Allows zero-knowledge selective disclosure and Groth16 zk-SNARK age proof generation without leaking signature points.
          </p>
        </div>
      )}
    </div>
  );
};
