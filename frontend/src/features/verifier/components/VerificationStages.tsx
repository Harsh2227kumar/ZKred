// frontend/src/features/verifier/components/VerificationStages.tsx
import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Fingerprint,
} from 'lucide-react';
import type { PresentationRequest, Verification } from '@/api/schemas';
import { useEnums } from '@/api/queries/meta';
import { toast } from 'sonner';

interface VerificationStagesProps {
  request: PresentationRequest;
  verifications: Verification[];
  isPolling?: boolean;
}

export const VerificationStages: React.FC<VerificationStagesProps> = ({
  request,
  verifications,
  isPolling = true,
}) => {
  const { data: enums } = useEnums();
  const [copied, setCopied] = useState(false);

  // Verification steps definition fallback if meta enum is still loading
  const defaultSteps = [
    { value: 'issuer_signature', label: 'Issuer BBS+ Signature' },
    { value: 'zk_proof', label: 'Zero-Knowledge Proof' },
    { value: 'revocation_status', label: 'On-Chain Revocation' },
    { value: 'key_epoch_anchor', label: 'Key-Epoch & Batch Anchor' },
  ];

  const stepsMeta = enums?.verification_steps?.length ? enums.verification_steps : defaultSteps;

  const handleCopyLink = () => {
    const url = request.wallet_url || `${window.location.origin}/wallet/respond?request=${request.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Shareable student response link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const latestVerification = verifications.length > 0 ? verifications[0] : null;

  return (
    <div className="space-y-6">
      {/* Real-time Status Card */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#231a3d] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[#f0f7f7]">Deterministic Evaluation Pipeline</h3>
              <p className="text-xs text-[#8ea5a8]">4-Stage Zero-Knowledge Verification Engine</p>
            </div>
          </div>

          <div>
            {latestVerification ? (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider ${
                  latestVerification.result === 'accepted'
                    ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                    : 'bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30'
                }`}
              >
                {latestVerification.result === 'accepted' ? (
                  <ShieldCheck className="w-3.5 h-3.5" />
                ) : (
                  <ShieldAlert className="w-3.5 h-3.5" />
                )}
                <span>VERIFICATION {latestVerification.result}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#06838d]/10 text-[#79bab6] border border-[#06838d]/30">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>Polling Student Submissions (2s)</span>
              </span>
            )}
          </div>
        </div>

        {/* 4 Pipeline Stages */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {stepsMeta.map((stepDef, idx) => {
            const stepResult = latestVerification?.steps?.find((s) => s.step === stepDef.value);
            const isFinished = Boolean(latestVerification);
            const isOk = stepResult ? stepResult.ok : false;

            return (
              <div
                key={stepDef.value}
                className={`p-4 rounded-2xl border transition-all space-y-2.5 flex flex-col justify-between ${
                  isFinished
                    ? isOk
                      ? 'border-[#10b981]/30 bg-[#10b981]/5'
                      : 'border-[#fb7185]/30 bg-[#fb7185]/5'
                    : 'border-[#231a3d] bg-[#090614]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#8ea5a8]">
                      STAGE {idx + 1}
                    </span>
                    {isFinished ? (
                      isOk ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#fb7185]" />
                      )
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-[#06838d] animate-ping" />
                    )}
                  </div>
                  <h4 className="text-xs font-semibold text-[#f0f7f7] mt-1">{stepDef.label}</h4>
                </div>

                <div className="pt-2 border-t border-[#231a3d]/60">
                  {isFinished ? (
                    <div className="text-[11px] leading-tight space-y-0.5">
                      <span className={`font-medium ${isOk ? 'text-[#10b981]' : 'text-[#fb7185]'}`}>
                        {isOk ? 'Passed evaluation' : 'Step verification failed'}
                      </span>
                      {stepResult?.code && (
                        <p className="text-[10px] text-[#8ea5a8] font-mono truncate">{stepResult.code}</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-[#8ea5a8]">
                      <Clock className="w-3 h-3 text-[#79bab6] animate-pulse" />
                      <span>Awaiting presentation...</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Revealed Attributes Display (if accepted and fields disclosed) */}
        {latestVerification && latestVerification.revealed && (
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-3 mt-4">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-4 h-4 text-[#79bab6]" />
              <h4 className="text-xs font-semibold text-[#f0f7f7]">Selectively Disclosed Attributes</h4>
            </div>

            {Object.keys(latestVerification.revealed).length === 0 ? (
              <p className="text-xs text-[#8ea5a8]">Zero attributes disclosed (100% Zero-Knowledge claim proof).</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(latestVerification.revealed).map(([reqId, fields]) => (
                  <div key={reqId} className="space-y-1.5">
                    <span className="text-[10px] font-mono text-[#79bab6]">Requirement {reqId}</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(fields).map(([fieldName, val]) => (
                        <div key={fieldName} className="p-2 rounded-xl bg-[#130e24] border border-[#231a3d] text-xs">
                          <span className="text-[10px] text-[#8ea5a8] block">{fieldName}</span>
                          <span className="font-mono text-[#f0f7f7] font-medium break-all">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shareable Wallet Link Banner */}
      {!latestVerification && (
        <div className="p-6 rounded-3xl border border-[#06838d]/30 bg-linear-to-r from-[#130e24] via-[#06838d]/10 to-[#130e24] space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[#f0f7f7]">Awaiting Holder Presentation</h4>
              <p className="text-xs text-[#8ea5a8] leading-relaxed">
                Provide this link to the student. Their wallet will encrypt and submit zero-knowledge proofs directly.
              </p>
            </div>
            <button
              type="button"
              onClick={handleCopyLink}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#06838d] hover:bg-[#046168] text-white shadow-md transition-colors shrink-0"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Student Link'}</span>
            </button>
          </div>

          <div className="p-3 rounded-xl bg-[#090614] border border-[#231a3d] flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-[#79bab6] truncate">
              {request.wallet_url || `${window.location.origin}/wallet/respond?request=${request.id}`}
            </span>
            <a
              href={request.wallet_url || `/wallet/respond?request=${request.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-1 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors shrink-0"
              title="Open respondent page"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {isPolling && (
            <div className="flex items-center gap-2 text-[11px] text-[#8ea5a8] pt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#10b981] animate-ping" />
              <span>Live listener active. The page will instantly refresh when the student signs the proof.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
