// frontend/src/features/wallet/components/ProvingProgressModal.tsx
import React, { useEffect, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  Loader2,
  Sparkles,
  Layers,
  Send,
  Lock,
  AlertCircle,
} from 'lucide-react';

export type ProvingStage =
  | 'IDLE'
  | 'RESOLVING_DEPENDENCIES'
  | 'DERIVING_BBS'
  | 'PROVING_AGE'
  | 'SUBMITTING'
  | 'COMPLETED'
  | 'FAILED';

interface ProvingProgressModalProps {
  stage: ProvingStage;
  hasAgePredicate: boolean;
  errorMessage?: string | null;
  onClose?: () => void;
}

export const ProvingProgressModal: React.FC<ProvingProgressModalProps> = ({
  stage,
  hasAgePredicate,
  errorMessage,
  onClose,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (stage === 'IDLE' || stage === 'COMPLETED' || stage === 'FAILED') return;
    const start = performance.now();
    const interval = setInterval(() => {
      setElapsedMs(Math.round(performance.now() - start));
    }, 50);
    return () => clearInterval(interval);
  }, [stage]);

  const stagesList = [
    {
      id: 'RESOLVING_DEPENDENCIES',
      title: 'Resolving On-Chain Issuers & Batch Anchors',
      description: 'Fetching Base Sepolia anchor keys and Merkle batch leaves',
      icon: Layers,
    },
    {
      id: 'DERIVING_BBS',
      title: 'Deriving Blinded BBS+ Signatures & Merkle Proofs',
      description: 'Blinding mandatory metadata & deriving selective disclosures bound to request nonce',
      icon: Shield,
    },
    ...(hasAgePredicate
      ? [
          {
            id: 'PROVING_AGE',
            title: 'Generating Groth16 zk-SNARK Range Proof',
            description: 'Proving Age ≥ 21 in browser WebAssembly on signed dob_commitment (DOB never disclosed)',
            icon: Sparkles,
          },
        ]
      : []),
    {
      id: 'SUBMITTING',
      title: 'Submitting Cryptographic Presentation',
      description: 'Transmitting zero-knowledge payload to verifier gateway for deterministic 4-stage evaluation',
      icon: Send,
    },
  ];

  const getStageStatus = (stageId: string) => {
    const stageOrder = [
      'RESOLVING_DEPENDENCIES',
      'DERIVING_BBS',
      ...(hasAgePredicate ? ['PROVING_AGE'] : []),
      'SUBMITTING',
      'COMPLETED',
    ];
    const currentIndex = stageOrder.indexOf(stage);
    const targetIndex = stageOrder.indexOf(stageId);

    if (stage === 'FAILED') {
      if (currentIndex === targetIndex) return 'FAILED';
      if (currentIndex > targetIndex) return 'DONE';
      return 'PENDING';
    }

    if (stage === 'COMPLETED' || currentIndex > targetIndex) return 'DONE';
    if (currentIndex === targetIndex) return 'ACTIVE';
    return 'PENDING';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#231a3d] bg-[#130e24] p-6 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#06838d]/20 text-[#79bab6] flex items-center justify-center">
                <Shield className="w-4.5 h-4.5" />
              </div>
              <h3 className="text-base font-semibold text-[#f0f7f7]">
                {stage === 'COMPLETED'
                  ? 'Presentation Verified & Delivered!'
                  : stage === 'FAILED'
                  ? 'Zero-Knowledge Prover Stopped'
                  : 'Generating Zero-Knowledge Presentation'}
              </h3>
            </div>
            <p className="text-xs text-[#8ea5a8]">
              {stage === 'COMPLETED'
                ? 'Your zero-knowledge proof has been verified and recorded.'
                : stage === 'FAILED'
                ? 'An error occurred during cryptographic proof generation.'
                : 'All proofs are computed client-side in your browser. Sensitive PII never leaves your device.'}
            </p>
          </div>

          <div className="px-2.5 py-1 rounded-full bg-[#090614] border border-[#231a3d] text-[11px] font-mono text-[#79bab6]">
            {(elapsedMs / 1000).toFixed(1)}s
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="space-y-3">
          {stagesList.map((s, idx) => {
            const status = getStageStatus(s.id);

            return (
              <div
                key={s.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  status === 'ACTIVE'
                    ? 'border-[#06838d] bg-[#06838d]/10'
                    : status === 'DONE'
                    ? 'border-[#10b981]/30 bg-[#10b981]/5'
                    : status === 'FAILED'
                    ? 'border-[#fb7185]/30 bg-[#fb7185]/5'
                    : 'border-[#231a3d]/60 bg-[#090614]/50 opacity-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {status === 'DONE' ? (
                      <CheckCircle2 className="w-4.5 h-4.5 text-[#10b981]" />
                    ) : status === 'ACTIVE' ? (
                      <Loader2 className="w-4.5 h-4.5 text-[#79bab6] animate-spin" />
                    ) : status === 'FAILED' ? (
                      <AlertCircle className="w-4.5 h-4.5 text-[#fb7185]" />
                    ) : (
                      <div className="w-4.5 h-4.5 rounded-full border border-[#8ea5a8]/30 flex items-center justify-center text-[10px] font-mono text-[#8ea5a8]">
                        {idx + 1}
                      </div>
                    )}
                  </div>

                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h4
                        className={`text-xs font-semibold truncate ${
                          status === 'ACTIVE'
                            ? 'text-[#f0f7f7]'
                            : status === 'DONE'
                            ? 'text-[#10b981]'
                            : status === 'FAILED'
                            ? 'text-[#fb7185]'
                            : 'text-[#8ea5a8]'
                        }`}
                      >
                        {s.title}
                      </h4>
                      <span className="text-[10px] font-mono text-[#8ea5a8] shrink-0 ml-2">
                        {status === 'ACTIVE'
                          ? 'Executing…'
                          : status === 'DONE'
                          ? '✓ Ready'
                          : status === 'FAILED'
                          ? 'Failed'
                          : 'Waiting'}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8ea5a8] leading-relaxed truncate">{s.description}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error message callout */}
        {stage === 'FAILED' && errorMessage && (
          <div className="p-4 rounded-2xl border border-[#fb7185]/30 bg-[#fb7185]/10 flex items-start gap-3 text-xs text-[#fb7185]">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">Proving Error</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Footer / Privacy Invariant */}
        <div className="pt-2 border-t border-[#231a3d] flex items-center justify-between text-[11px] text-[#8ea5a8]">
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-[#79bab6]" />
            <span>Zero-Knowledge Proof: Name, DOB & Salt remain client-side</span>
          </div>

          {(stage === 'COMPLETED' || stage === 'FAILED') && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#231a3d] hover:bg-[#2e2350] text-[#f0f7f7] transition-colors cursor-pointer"
            >
              {stage === 'COMPLETED' ? 'View Result' : 'Close'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
