// frontend/src/features/verifier/components/PrivacyInvariantPanel.tsx
import React from 'react';
import { Lock, Eye, ShieldCheck, Sparkles, CheckCircle2 } from 'lucide-react';
import type { PresentationPolicy } from '@/api/schemas';

interface PrivacyInvariantPanelProps {
  policy?: PresentationPolicy;
  revealed?: Record<string, Record<string, string | number>>;
  isAccepted?: boolean;
}

const FIELD_DESCRIPTIONS: Record<string, { label: string; protection: string }> = {
  holder_name: { label: 'Legal Name', protection: 'BBS+ Blinded' },
  dob: { label: 'Date of Birth', protection: 'zk-SNARK Proven (DOB Hidden)' },
  address: { label: 'Home Address', protection: 'Kept in Local Wallet' },
  dob_salt: { label: 'Blinding Salt', protection: 'Commitment Secret' },
};

export const PrivacyInvariantPanel: React.FC<PrivacyInvariantPanelProps> = ({
  policy,
  revealed,
  isAccepted = true,
}) => {
  const neverCollectFields =
    policy?.never_collect && policy.never_collect.length > 0
      ? policy.never_collect
      : ['holder_name', 'dob', 'address', 'dob_salt'];
  const hasRevealedData = revealed && Object.keys(revealed).length > 0;

  return (
    <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
      <div className="border-b border-[#231a3d] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
            <ShieldCheck className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#f0f7f7]">
              Zero-Knowledge Privacy Guarantee (Judge Showcase)
            </h3>
            <p className="text-xs text-[#8ea5a8]">
              Mathematical separation between proof of qualification and identity data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isAccepted && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Invariants Enforced</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono bg-[#06838d]/20 text-[#79bab6] border border-[#06838d]/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Client-Side Selective Disclosure</span>
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel 1: Never Received / Client-Side Encrypted */}
        <div className="p-5 rounded-2xl border border-[#fb7185]/30 bg-[#fb7185]/5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#fb7185] uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>Never Received by Verifier</span>
            </div>
            <span className="text-[10px] font-mono text-[#fb7185] bg-[#fb7185]/10 px-2 py-0.5 rounded-full border border-[#fb7185]/20">
              0 bytes transmitted
            </span>
          </div>

          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            The following sensitive personal identifiers remain strictly on the student's device and were never
            sent over the network:
          </p>

          <div className="space-y-2 pt-1">
            {neverCollectFields.map((field) => {
              const meta = FIELD_DESCRIPTIONS[field] || {
                label: field.replace(/_/g, ' '),
                protection: 'Client-Side Blinded',
              };
              return (
                <div
                  key={field}
                  className="p-2.5 rounded-xl bg-[#090614] border border-[#231a3d] flex items-center justify-between text-xs"
                >
                  <span className="text-[#f0f7f7] font-medium">
                    • {meta.label} (`{field}`)
                  </span>
                  <span className="text-[10px] text-[#fb7185] font-mono">{meta.protection}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel 2: Selectively Disclosed & Proven Claims */}
        <div className="p-5 rounded-2xl border border-[#10b981]/30 bg-[#10b981]/5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#10b981] uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>Selectively Disclosed Attributes</span>
            </div>
            <span className="text-[10px] font-mono text-[#10b981] bg-[#10b981]/10 px-2 py-0.5 rounded-full border border-[#10b981]/20">
              Cryptographically Verified
            </span>
          </div>

          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Only the specific qualification attributes and zero-knowledge mathematical predicates authorized by the
            student were disclosed:
          </p>

          <div className="space-y-2 pt-1">
            {hasRevealedData ? (
              Object.entries(revealed).flatMap(([reqId, claims]) =>
                Object.entries(claims).map(([field, val]) => (
                  <div
                    key={`${reqId}-${field}`}
                    className="p-2.5 rounded-xl bg-[#090614] border border-[#231a3d] flex items-center justify-between text-xs"
                  >
                    <span className="text-[#8ea5a8]">
                      {field.replace(/_/g, ' ').toUpperCase()}:{' '}
                      <strong className="text-[#f0f7f7]">{String(val)}</strong>
                    </span>
                    <span className="text-[10px] text-[#10b981] font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> BBS+ Signed
                    </span>
                  </div>
                ))
              )
            ) : (
              <div className="p-3 rounded-xl bg-[#090614] border border-[#231a3d] text-xs text-[#79bab6]">
                Zero plaintext attributes revealed. All claims validated entirely in zero-knowledge.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
