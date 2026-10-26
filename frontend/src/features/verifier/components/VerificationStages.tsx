// frontend/src/features/verifier/components/VerificationStages.tsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Clock,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Layers,
  QrCode,
  Smartphone,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { PresentationRequest, Verification } from '@/api/schemas';
import { useEnums } from '@/api/queries/meta';
import { toast } from 'sonner';
import { EvalChainVisualizer } from './EvalChainVisualizer';
import { PrivacyInvariantPanel } from './PrivacyInvariantPanel';

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
  const [showQrDetails, setShowQrDetails] = useState(false);

  // Verification steps definition fallback if meta enum is still loading
  const defaultSteps = [
    { value: 'issuer_signature', label: 'Issuer BBS+ Signature' },
    { value: 'zk_claim', label: 'Zero-Knowledge Claim' },
    { value: 'revocation_status', label: 'On-Chain Revocation' },
    { value: 'key_epoch_anchor', label: 'Key-Epoch & Batch Anchor' },
  ];

  const stepsMeta = enums?.verification_steps?.length ? enums.verification_steps : defaultSteps;

  const shareUrl =
    request.wallet_url || `${window.location.origin}/wallet/respond?request=${request.id}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success('Shareable student response link copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const latestVerification = verifications.length > 0 ? verifications[0] : null;

  return (
    <div className="space-y-8">
      {/* If a verification result exists, render the 4-node Eval Chain Visualizer & Privacy Invariant Panel */}
      {latestVerification ? (
        <div className="space-y-8 animate-fadeIn">
          {/* Top Banner: Verification Outcome Summary */}
          <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  latestVerification.result === 'accepted'
                    ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30'
                    : 'bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/30'
                }`}
              >
                {latestVerification.result === 'accepted' ? (
                  <ShieldCheck className="w-5 h-5" />
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[#f0f7f7]">
                    Deterministic Evaluation Result
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold uppercase ${
                      latestVerification.result === 'accepted'
                        ? 'bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30'
                        : 'bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30'
                    }`}
                  >
                    {latestVerification.result}
                  </span>
                </div>
                <p className="text-xs text-[#8ea5a8]">
                  Timestamp:{' '}
                  <span className="font-mono text-[#f0f7f7]">
                    {new Date(latestVerification.created_at).toLocaleString()}
                  </span>{' '}
                  • Mode: <span className="font-mono text-[#79bab6]">{latestVerification.mode}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowQrDetails(!showQrDetails)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#8ea5a8] hover:text-[#f0f7f7] bg-[#090614] border border-[#231a3d] transition-colors self-start sm:self-auto"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>{showQrDetails ? 'Hide Request Link' : 'View Mobile QR'}</span>
              {showQrDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Collapsible Mobile QR Section when verification is completed */}
          {showQrDetails && (
            <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#090614] space-y-4 animate-fadeIn">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="p-3 rounded-2xl bg-white border border-[#231a3d] shrink-0 shadow-md">
                  <QRCodeSVG value={shareUrl} size={110} level="M" />
                </div>
                <div className="space-y-2 text-center sm:text-left flex-1 min-w-0">
                  <h4 className="text-xs font-semibold text-[#f0f7f7] flex items-center justify-center sm:justify-start gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-[#79bab6]" />
                    <span>Presentation Request Target</span>
                  </h4>
                  <p className="text-xs text-[#8ea5a8]">
                    This presentation was evaluated for request nonce{' '}
                    <span className="font-mono text-[#f0f7f7]">{request.nonce.slice(0, 12)}...</span>
                  </p>
                  <div className="flex items-center gap-2 pt-1 max-w-md">
                    <span className="text-xs font-mono text-[#79bab6] truncate bg-[#130e24] px-3 py-1.5 rounded-xl border border-[#231a3d] flex-1">
                      {shareUrl}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="p-2 rounded-xl bg-[#06838d] hover:bg-[#046168] text-white shrink-0 transition-colors"
                      title="Copy link"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4-Node Evaluation Chain Visualizer */}
          <EvalChainVisualizer request={request} verification={latestVerification} />

          {/* Zero-Knowledge Privacy Invariant Panel */}
          <PrivacyInvariantPanel
            policy={request.policy}
            revealed={latestVerification.revealed}
            isAccepted={latestVerification.result === 'accepted'}
          />
        </div>
      ) : (
        /* Awaiting Presentation State: Show Pipeline Waiting State + Mobile QR Code Banner */
        <div className="space-y-6">
          {/* Pipeline Stages Card (Pending state) */}
          <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#231a3d] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
                  <Layers className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[#f0f7f7]">
                    Deterministic Evaluation Pipeline
                  </h3>
                  <p className="text-xs text-[#8ea5a8]">
                    4-Stage Zero-Knowledge Verification Engine
                  </p>
                </div>
              </div>

              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-[#06838d]/10 text-[#79bab6] border border-[#06838d]/30">
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Polling Student Submissions (2s)</span>
                </span>
              </div>
            </div>

            {/* 4 Pipeline Stages in Pending Mode */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stepsMeta.map((stepDef, idx) => (
                <div
                  key={stepDef.value}
                  className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-[#8ea5a8]">
                        STAGE {idx + 1}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-[#06838d] animate-ping" />
                    </div>
                    <h4 className="text-xs font-semibold text-[#f0f7f7] mt-1">{stepDef.label}</h4>
                  </div>

                  <div className="pt-2 border-t border-[#231a3d]/60">
                    <div className="flex items-center gap-1.5 text-xs text-[#8ea5a8]">
                      <Clock className="w-3 h-3 text-[#79bab6] animate-pulse" />
                      <span>Awaiting presentation...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive QR Code & Student Respondent Link Card */}
          <div className="p-6 rounded-3xl border border-[#06838d]/30 bg-linear-to-r from-[#130e24] via-[#06838d]/10 to-[#130e24] space-y-5">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* QR Code */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#231a3d] shrink-0 shadow-lg shadow-[#06838d]/10">
                <QRCodeSVG value={shareUrl} size={140} level="M" />
              </div>

              {/* Action details */}
              <div className="space-y-3 text-center md:text-left flex-1 min-w-0 w-full">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-[#06838d]/20 text-[#79bab6] border border-[#06838d]/30">
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile Respondent Supported</span>
                  </div>
                  <h4 className="text-sm font-semibold text-[#f0f7f7]">
                    Scan QR on Mobile or Share Link with Student
                  </h4>
                  <p className="text-xs text-[#8ea5a8] leading-relaxed">
                    The student's browser wallet encrypts and generates zero-knowledge proofs locally
                    using WebAssembly zk-SNARK prover and BBS+ selective disclosure. No server holds their private key.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-[#090614] border border-[#231a3d] flex items-center justify-between gap-3 min-w-0">
                  <span className="text-xs font-mono text-[#79bab6] truncate min-w-0" title={shareUrl}>{shareUrl}</span>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <NavLink
                      to={`/wallet/respond?request=${request.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-linear-to-r from-[#06838d] to-[#014f85] text-white shadow-xs hover:opacity-90 transition-opacity"
                    >
                      <span>⚡ Respond as Holder</span>
                    </NavLink>
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#130e24] hover:bg-[#1a1430] border border-[#231a3d] text-[#f0f7f7] shadow-xs transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#79bab6]" /> : <Copy className="w-3.5 h-3.5 text-[#8ea5a8]" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-[#8ea5a8] hover:text-[#f0f7f7] bg-[#130e24] border border-[#231a3d] transition-colors"
                      title="Open respondent page in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>

                {isPolling && (
                  <div className="flex items-center justify-center md:justify-start gap-2 text-[11px] text-[#8ea5a8]">
                    <div className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                    <span>
                      Live listener active. This evaluation dashboard will update automatically upon signature.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
