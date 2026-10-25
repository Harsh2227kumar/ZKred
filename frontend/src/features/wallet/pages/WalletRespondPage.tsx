import React from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Shield, Eye, Lock, ShieldCheck } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');

  if (!requestId) {
    return (
      <EmptyState
        title="Missing Verification Request"
        description="Please scan or open a valid credential verification request link."
        action={
          <NavLink to="/wallet" className="text-xs text-[#79bab6] font-medium hover:underline">
            Go to My Student Wallet
          </NavLink>
        }
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <NavLink to="/wallet" className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Student Wallet
      </NavLink>

      <div className="p-6 sm:p-8 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-xl font-semibold text-[#f0f7f7]">Student Proof Consent & Disclosure</h1>
          </div>
          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Review exactly what attributes will be revealed to the verifier versus what remains private or proven in zero-knowledge.
          </p>
        </div>

        {/* 3 Categories of Disclosure */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6] uppercase tracking-wider">
              <Eye className="w-4 h-4" />
              <span>Selectively Disclosed Fields</span>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              These specific attributes will be visible to the verifier (BBS+ selective disclosure):
            </p>
            <p className="text-xs font-mono text-[#8ea5a8]">Derived from request policy.</p>
          </div>

          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#79bab6] uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4" />
              <span>Proven in Zero-Knowledge (Groth16)</span>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              The verifier only receives a cryptographic proof that the condition is met (e.g. "Age ≥ 21" or "Enrolled = Yes"). The actual data is never sent:
            </p>
            <p className="text-xs font-mono text-[#8ea5a8]">Derived from request policy.</p>
          </div>

          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">
              <Lock className="w-4 h-4" />
              <span>Never Disclosed / Stays on Device</span>
            </div>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              These fields stay encrypted on your device and are never sent:
            </p>
            <p className="text-xs font-mono text-[#8ea5a8]">Student ID, full address, date of birth.</p>
          </div>
        </div>

        <button
          type="button"
          disabled
          className="w-full py-3 rounded-xl font-medium text-sm bg-[#06838d]/40 text-white cursor-not-allowed text-center transition-all"
        >
          Generate & Submit Proof (Available in V1)
        </button>
      </div>
    </div>
  );
};
