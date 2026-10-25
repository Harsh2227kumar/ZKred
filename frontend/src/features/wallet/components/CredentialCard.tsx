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
} from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import type { SignedCredential } from '@/lib/wallet-crypto';
import type { Issuer } from '@/api/schemas';

interface CredentialCardProps {
  credential: SignedCredential;
  issuer?: Issuer;
}

const PII_FIELD_NAMES = new Set([
  'holder_name',
  'dob',
  'address',
  'grade',
  'registration_no',
  'dob_salt',
]);

export const CredentialCard: React.FC<CredentialCardProps> = ({ credential, issuer }) => {
  const [showPii, setShowPii] = useState(false);

  const credType = credential.type;
  const values = credential.values || {};

  // Issuer key status check
  const activeKey = issuer?.keys?.find((k) => k.key_id === credential.key_id);
  const isKeyActive = activeKey?.status === 'active';

  const formatFieldLabel = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

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

      {/* Claims Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {Object.entries(values).map(([k, v]) => {
          // Skip internal BBS meta fields in the claims section
          if (
            [
              'cred_type',
              'issuer_did',
              'key_id',
              'batch_id',
              'status_list_id',
              'status_index',
              'commitment',
              'dob_commitment',
            ].includes(k)
          ) {
            return null;
          }

          const isPii = PII_FIELD_NAMES.has(k);

          return (
            <div key={k} className="p-3 rounded-2xl bg-[#090614] border border-[#231a3d] space-y-1">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#8ea5a8]">
                <span>{formatFieldLabel(k)}</span>
                {isPii && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-[#79bab6]">
                    <Lock className="w-2.5 h-2.5" /> PII
                  </span>
                )}
              </div>
              <div className="text-xs font-medium text-[#f0f7f7]">
                {isPii && !showPii ? (
                  <span className="tracking-widest text-[#8ea5a8]/70 select-none">••••••••</span>
                ) : (
                  <span>{String(v)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Technical Evidence Footer */}
      <div className="pt-3 border-t border-[#231a3d] flex flex-wrap items-center justify-between gap-3 text-[11px] text-[#8ea5a8]">
        <div className="flex items-center gap-2">
          <span>Key Epoch:</span>
          <Hex value={credential.key_id} prefixLen={6} suffixLen={4} />
          {isKeyActive ? (
            <span className="inline-flex items-center gap-1 text-[#79bab6]">
              <ShieldCheck className="w-3 h-3" /> Valid
            </span>
          ) : (
            <span className="text-[#ff9f0a]">Rotated</span>
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
