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
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1a1430] text-[11px] text-[#8ea5a8]">
        <AlertTriangle className="w-3.5 h-3.5" /> Status unknown: the revocation list and key status could not be read right now
      </div>
    );
  }
  if (!status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#1a1430] text-[11px] text-[#8ea5a8]">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking revocation list and key status on-chain…
      </div>
    );
  }
  const base = 'flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2.5 rounded-2xl border text-xs';
  switch (status.kind) {
    case 'active':
      return (
        <div className={`${base} bg-[#06838d]/10 border-[#06838d]/30 text-[#79bab6]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" /> Active: verifiers accept it{status.note ? `. ${status.note}` : ''}
          </span>
        </div>
      );
    case 'pending_anchor':
      return (
        <div className={`${base} bg-[#ff9f0a]/10 border-[#ff9f0a]/25 text-[#ff9f0a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 shrink-0" /> Waiting for the issuer to anchor its batch on-chain
          </span>
        </div>
      );
    case 'revoked':
      return (
        <div className={`${base} bg-[#ff453a]/10 border-[#ff453a]/25 text-[#ff453a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Ban className="w-4 h-4 shrink-0" /> Revoked by the issuer: verifiers reject it
          </span>
        </div>
      );
    case 'needs_refresh':
      return (
        <div className={`${base} bg-[#ff9f0a]/10 border-[#ff9f0a]/25 text-[#ff9f0a]`}>
          <span className="inline-flex items-start gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {status.reason}. Verifiers reject it until you refresh it.
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ff9f0a] text-[#090614] font-semibold whitespace-nowrap hover:bg-[#ff9f0a]/90 disabled:opacity-60 cursor-pointer"
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
            <RefreshCw className="w-4 h-4 shrink-0" /> Replaced: a fresh copy signed with the issuer's new key is in your inbox
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
        <div className={`${base} bg-[#ff453a]/10 border-[#ff453a]/25 text-[#ff453a]`}>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" /> Not verifiable: {status.reason}
          </span>
        </div>
      );
  }
};

export const CredentialCard: React.FC<CredentialCardProps> = ({ credential, issuer, status, statusUnavailable, onRefresh, refreshing, onRemove }) => {
  const [showPii, setShowPii] = useState(false);

  const credType = credential.type;
  const values = credential.values || {};

  // Issuer key status check
  const activeKey = issuer?.keys?.find((k) => k.key_id === credential.key_id);

  return (
    <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#06838d]/40 transition-all space-y-5 shadow-xs">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
            {credType === 'Degree' ? (
              <GraduationCap className="w-5 h-5" />
            ) : credType === 'MedicalLicense' ? (
              <FileBadge className="w-5 h-5" />
            ) : (
              <UserCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-[#f0f7f7]">{credType}</h3>
              <span className="text-[10px] text-[#79bab6] bg-[#06838d]/15 px-2 py-0.5 rounded-full border border-[#06838d]/25">
                BBS+ Signed
              </span>
            </div>
            <p className="text-xs text-[#8ea5a8] mt-0.5">
              Issued by {issuer?.name || credential.issuer_did}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowPii(!showPii)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#231a3d] bg-[#090614] hover:bg-[#1a1430] text-[11px] font-medium text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors cursor-pointer"
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

      <StatusBanner status={status} statusUnavailable={statusUnavailable} onRefresh={onRefresh} refreshing={refreshing} onRemove={onRemove} />

      {/* Claims Grid: the layout's claim fields (labels + PII flags from the frozen CREDENTIAL_LAYOUTS) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {displayFields(credential).map((f) => (
          <div key={f.name} className="p-3 rounded-2xl bg-[#090614] border border-[#231a3d] space-y-1">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8ea5a8]">
              <span>{f.label}</span>
              {f.pii && (
                <span className="inline-flex items-center gap-1 text-[10px] text-[#79bab6]">
                  <Lock className="w-2.5 h-2.5" /> PII
                </span>
              )}
            </div>
            <div className="text-xs font-medium text-[#f0f7f7] break-words">
              {f.pii && !showPii ? <span className="tracking-widest text-[#8ea5a8]/70 select-none">••••••••</span> : <span>{f.value}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Technical Evidence Footer */}
      <div className="pt-3 border-t border-[#231a3d] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#8ea5a8]">
        <div className="flex items-center gap-2">
          <span>Key Epoch:</span>
          <Hex value={credential.key_id} prefixLen={6} suffixLen={4} />
          {activeKey?.status === 'active' ? (
            <span className="inline-flex items-center gap-1 text-[#79bab6]">
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

        {values.commitment && (
          <div className="flex items-center gap-2">
            <span>Commitment:</span>
            <Hex value={values.commitment} prefixLen={6} suffixLen={4} />
          </div>
        )}
      </div>
    </div>
  );
};
