// frontend/src/features/wallet/components/PresentationResultCard.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ArrowLeft,
  Building2,
  Fingerprint,
  Lock,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
} from 'lucide-react';
import type { PresentationRequest, Verification } from '@/api/schemas';
import { Hex } from '@/components/common/Hex';

interface PresentationResultCardProps {
  request: PresentationRequest;
  verification: Verification;
  onRetry?: () => void;
}

export const PresentationResultCard: React.FC<PresentationResultCardProps> = ({
  request,
  verification,
  onRetry,
}) => {
  const isAccepted = verification.result === 'accepted';
  const steps = verification.steps || [];

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
      {/* Primary Verification Badge Card */}
      <div
        className={`p-6 sm:p-8 rounded-3xl border space-y-5 transition-all shadow-xl ${
          isAccepted
            ? 'border-[#10b981]/40 bg-[#10b981]/10 shadow-[#10b981]/5'
            : 'border-[#fb7185]/40 bg-[#fb7185]/10 shadow-[#fb7185]/5'
        }`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#231a3d]/80 pb-5">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                isAccepted ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#fb7185]/20 text-[#fb7185]'
              }`}
            >
              {isAccepted ? <ShieldCheck className="w-7 h-7" /> : <ShieldAlert className="w-7 h-7" />}
            </div>
            <div>
              <span className="text-[11px] font-mono tracking-wider uppercase block text-[#8ea5a8]">
                Evaluation Verdict
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[#f0f7f7]">
                {isAccepted ? 'Verified Portable Credential' : 'Presentation Rejected'}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                isAccepted
                  ? 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30'
                  : 'bg-[#fb7185]/20 text-[#fb7185] border-[#fb7185]/30'
              }`}
            >
              {isAccepted ? 'Accepted by Verifier' : 'Evaluation Failed'}
            </span>
          </div>
        </div>

        {/* Verifier Identity & Timestamp */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-[#8ea5a8]">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#79bab6]" />
            <div>
              <span className="block text-[10px] text-[#8ea5a8]/70 uppercase">Agency</span>
              <span className="text-[#f0f7f7] font-medium">{request.verifier_name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#79bab6]" />
            <div>
              <span className="block text-[10px] text-[#8ea5a8]/70 uppercase">Verified At</span>
              <span className="text-[#f0f7f7] font-medium">
                {new Date(verification.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#79bab6]" />
            <div>
              <span className="block text-[10px] text-[#8ea5a8]/70 uppercase">Verification ID</span>
              <Hex value={verification.id} prefixLen={8} suffixLen={6} />
            </div>
          </div>
        </div>
      </div>

      {/* 4-Stage Deterministic Verification Node Results */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
        <div className="border-b border-[#231a3d] pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#79bab6]" />
            <h3 className="text-sm font-semibold text-[#f0f7f7]">4-Stage Evaluation Pipeline</h3>
          </div>
          <span className="text-[11px] font-mono text-[#8ea5a8]">Mode: {verification.mode}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {steps.map((s, idx) => (
            <div
              key={s.step}
              className={`p-4 rounded-2xl border transition-all space-y-2 flex flex-col justify-between ${
                s.ok
                  ? 'border-[#10b981]/30 bg-[#10b981]/5'
                  : 'border-[#fb7185]/30 bg-[#fb7185]/5'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase text-[#8ea5a8]">STAGE {idx + 1}</span>
                  {s.ok ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#fb7185]" />
                  )}
                </div>
                <h4 className="text-xs font-semibold text-[#f0f7f7] mt-1 capitalize">
                  {s.step.replace(/_/g, ' ')}
                </h4>
              </div>

              <div className="pt-2 border-t border-[#231a3d]/60">
                <span className={`text-[11px] font-medium block ${s.ok ? 'text-[#10b981]' : 'text-[#fb7185]'}`}>
                  {s.ok ? 'Verified ✓' : 'Failed ✗'}
                </span>
                {s.code && <p className="text-[10px] text-[#8ea5a8] font-mono truncate">{s.code}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revealed Attributes Summary */}
      {verification.revealed && (
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center gap-2 border-b border-[#231a3d] pb-3">
            <Fingerprint className="w-4.5 h-4.5 text-[#79bab6]" />
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Selectively Disclosed Attributes</h3>
          </div>

          <div className="space-y-3">
            {Object.entries(verification.revealed).map(([reqId, claims]) => (
              <div key={reqId} className="p-3.5 rounded-2xl bg-[#090614] border border-[#231a3d] space-y-2">
                <span className="text-[10px] font-mono text-[#79bab6] uppercase block">
                  Requirement: {reqId}
                </span>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(claims).map(([field, val]) => (
                    <span
                      key={field}
                      className="px-2.5 py-1 rounded-lg text-xs font-mono bg-[#130e24] text-[#f0f7f7] border border-[#231a3d]"
                    >
                      <strong className="text-[#79bab6]">{field}:</strong> {String(val)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prominent Zero-Knowledge Privacy Guarantee Callout */}
      <div className="p-5 rounded-3xl border border-[#06838d]/30 bg-[#06838d]/10 flex items-start gap-3.5 text-xs">
        <Lock className="w-5 h-5 text-[#79bab6] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-[#f0f7f7] block">
            Mathematical Zero-Knowledge Privacy Guarantee
          </span>
          <p className="text-[#8ea5a8] leading-relaxed">
            Your name, date of birth, and home address were never transmitted over the network or revealed to{' '}
            <strong className="text-[#f0f7f7]">{request.verifier_name}</strong>. Verification was proven mathematically
            via blinded BBS+ signatures and Groth16 zk-SNARK age proofs calculated on your device.
          </p>
        </div>
      </div>

      {/* Action Navigation */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <NavLink
          to="/wallet"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#130e24] border border-[#231a3d] hover:bg-[#1a1430] text-[#f0f7f7] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Student Wallet
        </NavLink>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isAccepted && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#fb7185] hover:bg-[#e11d48] text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
          )}

          <NavLink
            to={`/verifier/requests/${request.id}`}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-2xl text-xs font-semibold bg-[#06838d] hover:bg-[#046168] text-white transition-colors shadow-lg shadow-[#06838d]/20"
          >
            <span>View in Verifier Portal</span>
            <ExternalLink className="w-4 h-4" />
          </NavLink>
        </div>
      </div>
    </div>
  );
};
