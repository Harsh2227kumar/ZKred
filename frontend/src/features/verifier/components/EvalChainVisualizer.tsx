// frontend/src/features/verifier/components/EvalChainVisualizer.tsx
import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  KeyRound,
  Cpu,
  Radio,
  Anchor,
  ArrowRight,
  AlertTriangle,
  Award,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { PresentationRequest, Verification } from '@/api/schemas';
import { getStepErrorDiagnosis } from './StepErrorDiagnosis';

interface EvalChainVisualizerProps {
  request: PresentationRequest;
  verification: Verification;
}

interface StepMeta {
  key: 'issuer_signature' | 'zk_claim' | 'revocation_status' | 'key_epoch_anchor';
  label: string;
  description: string;
  icon: React.ElementType;
}

const EVAL_STEPS: StepMeta[] = [
  {
    key: 'issuer_signature',
    label: 'Issuer BBS+ Signature',
    description: 'On-chain BLS12-381 key, pubkey hash binding & nonce proof',
    icon: KeyRound,
  },
  {
    key: 'zk_claim',
    label: 'Zero-Knowledge Claim',
    description: 'Selective disclosure matching & Groth16 age range zk-SNARK',
    icon: Cpu,
  },
  {
    key: 'revocation_status',
    label: 'On-Chain Revocation',
    description: 'Status registry 16k bitstring proof pinned on Base Sepolia',
    icon: Radio,
  },
  {
    key: 'key_epoch_anchor',
    label: 'Key-Epoch & Batch Anchor',
    description: 'Poseidon Merkle inclusion & 48h breach window verification',
    icon: Anchor,
  },
];

export const EvalChainVisualizer: React.FC<EvalChainVisualizerProps> = ({ request, verification }) => {
  const requirements = request.policy?.requirements || [];
  const isAllAccepted = verification.result === 'accepted';

  return (
    <div className="space-y-8">
      {/* Requirement Evaluation Pipelines */}
      <div className="space-y-6">
        {requirements.map((req, reqIndex) => {
          // Filter steps for this specific requirement
          const reqSteps = verification.steps.filter((s) => s.requirement_id === req.id);
          const failedStep = reqSteps.find((s) => !s.ok);
          const reqPassed = reqSteps.length > 0 && !failedStep;

          return (
            <div
              key={req.id}
              className={`p-6 rounded-3xl border transition-all ${
                reqPassed
                  ? 'border-[#10b981]/30 bg-linear-to-b from-[#130e24] via-[#10b981]/5 to-[#130e24]'
                  : failedStep
                    ? 'border-[#fb7185]/30 bg-linear-to-b from-[#130e24] via-[#fb7185]/5 to-[#130e24]'
                    : 'border-[#231a3d] bg-[#130e24]'
              }`}
            >
              {/* Requirement Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#231a3d] pb-4 mb-6">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#06838d]/15 text-[#79bab6] border border-[#06838d]/30">
                      Requirement #{reqIndex + 1}
                    </span>
                    <span className="text-xs font-mono text-[#f0f7f7] font-semibold">
                      {req.credential_type}
                    </span>
                    {req.accredited_only && (
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20">
                        Accredited Only
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#8ea5a8]">
                    Evaluated under policy constraints: ID{' '}
                    <span className="font-mono text-[#f0f7f7]">{req.id}</span>
                  </p>
                </div>

                <div>
                  {reqPassed ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>REQUIREMENT SATISFIED</span>
                    </span>
                  ) : failedStep ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#fb7185]/15 text-[#fb7185] border border-[#fb7185]/30">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>STAGE FAILED: {failedStep.step.toUpperCase()}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-[#8ea5a8] bg-[#090614] border border-[#231a3d]">
                      <span>UNCHECKED</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 4 Sequential Nodes */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
                {EVAL_STEPS.map((stepMeta, stepIndex) => {
                  const stepResult = reqSteps.find((s) => s.step === stepMeta.key);
                  const isChecked = Boolean(stepResult);
                  const isPassed = stepResult?.ok === true;
                  const isFailed = stepResult && !stepResult.ok;
                  const isHalted = !stepResult && Boolean(failedStep);
                  const Icon = stepMeta.icon;

                  return (
                    <div key={stepMeta.key} className="flex flex-col relative group">
                      {/* Connection arrow on desktop */}
                      {stepIndex < EVAL_STEPS.length - 1 && (
                        <div className="hidden md:flex absolute -right-3 top-7 z-10 text-[#8ea5a8]/40">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}

                      <div
                        className={`p-4 rounded-2xl border transition-all h-full flex flex-col justify-between ${
                          isPassed
                            ? 'border-[#10b981]/40 bg-[#10b981]/10 shadow-sm shadow-[#10b981]/10'
                            : isFailed
                              ? 'border-[#fb7185]/50 bg-[#fb7185]/10 shadow-sm shadow-[#fb7185]/10'
                              : isHalted
                                ? 'border-[#231a3d]/50 bg-[#090614]/50 opacity-40'
                                : 'border-[#231a3d] bg-[#090614]'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                                isPassed
                                  ? 'bg-[#10b981]/20 text-[#10b981]'
                                  : isFailed
                                    ? 'bg-[#fb7185]/20 text-[#fb7185]'
                                    : 'bg-[#231a3d] text-[#8ea5a8]'
                              }`}
                            >
                              STAGE 0{stepIndex + 1}
                            </span>
                            {isPassed ? (
                              <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                            ) : isFailed ? (
                              <XCircle className="w-4 h-4 text-[#fb7185]" />
                            ) : isHalted ? (
                              <span className="text-[10px] font-mono text-[#8ea5a8]">HALTED</span>
                            ) : (
                              <div className="w-2 h-2 rounded-full bg-[#8ea5a8]" />
                            )}
                          </div>

                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                                isPassed
                                  ? 'bg-[#10b981]/20 text-[#10b981]'
                                  : isFailed
                                    ? 'bg-[#fb7185]/20 text-[#fb7185]'
                                    : 'bg-[#130e24] text-[#8ea5a8] border border-[#231a3d]'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="text-xs font-semibold text-[#f0f7f7] leading-snug">
                                {stepMeta.label}
                              </h4>
                              <p className="text-[10px] text-[#8ea5a8] mt-1 line-clamp-2 leading-relaxed">
                                {stepMeta.description}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Status Footer */}
                        <div className="pt-3 mt-3 border-t border-[#231a3d]/60">
                          {isChecked ? (
                            isPassed ? (
                              <div className="text-[10px] text-[#10b981] font-mono flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Verified OK</span>
                              </div>
                            ) : (
                              <div className="text-[10px] text-[#fb7185] font-mono flex items-center gap-1 font-semibold truncate">
                                <XCircle className="w-3 h-3 shrink-0" />
                                <span>Failed: {stepResult?.code || 'UNKNOWN'}</span>
                              </div>
                            )
                          ) : isHalted ? (
                            <span className="text-[10px] text-[#8ea5a8] italic">Halted (fail-fast)</span>
                          ) : (
                            <span className="text-[10px] text-[#8ea5a8]">Unchecked</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Step Error Diagnosis Box (if this requirement failed) */}
              {failedStep && (
                <div className="mt-5 p-4 rounded-2xl border border-[#fb7185]/40 bg-[#fb7185]/10 space-y-2.5 animate-fadeIn">
                  {(() => {
                    const diagnosis = getStepErrorDiagnosis(failedStep.code);
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-[#fb7185]" />
                            <h5 className="text-xs font-semibold text-[#fb7185]">
                              {diagnosis.title}
                            </h5>
                          </div>
                          <span className="text-[10px] font-mono bg-[#fb7185]/20 text-[#fb7185] px-2 py-0.5 rounded-full border border-[#fb7185]/30">
                            CODE: {failedStep.code}
                          </span>
                        </div>
                        <p className="text-xs text-[#f0f7f7] leading-relaxed">
                          {diagnosis.explanation}
                        </p>
                        <div className="p-2.5 rounded-xl bg-[#090614]/80 border border-[#fb7185]/20 text-[11px] text-[#8ea5a8]">
                          <strong className="text-[#fb7185]">Security Diagnosis:</strong>{' '}
                          {failedStep.message || diagnosis.recommendation}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grand Outcome Badge */}
      {isAllAccepted ? (
        <div className="p-6 rounded-3xl border border-[#10b981]/40 bg-linear-to-r from-[#10b981]/15 via-[#06838d]/20 to-[#10b981]/15 text-center space-y-4 shadow-lg shadow-[#10b981]/5">
          <div className="inline-flex p-3 rounded-2xl bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40">
            <Award className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>CRYPTOGRAPHICALLY CONVERGED</span>
            </div>
            <h3 className="text-lg font-bold text-[#f0f7f7]">
              Verified Portable Credential
            </h3>
            <p className="text-xs text-[#8ea5a8] max-w-xl mx-auto leading-relaxed">
              All 4 zero-knowledge evaluation stages completed successfully. Issuer signature, zero-knowledge
              predicate, Base Sepolia revocation bitstring, and timestamped Merkle batch inclusion were verified
              without collecting raw identity PII.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-[#79bab6] pt-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090614]/70 border border-[#231a3d]">
              <Layers className="w-3.5 h-3.5" />
              <span>Mode: {verification.mode.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090614]/70 border border-[#231a3d]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#10b981]" />
              <span>Result: ACCEPTED</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#090614]/70 border border-[#231a3d]">
              <span className="text-[#8ea5a8]">Verification ID:</span>
              <span className="text-[#f0f7f7]">{verification.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 rounded-3xl border border-[#fb7185]/40 bg-linear-to-r from-[#fb7185]/15 via-[#130e24] to-[#fb7185]/15 text-center space-y-3">
          <div className="inline-flex p-3 rounded-2xl bg-[#fb7185]/20 text-[#fb7185] border border-[#fb7185]/40">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#f0f7f7]">
              Presentation Rejected (Fail-Closed)
            </h3>
            <p className="text-xs text-[#8ea5a8] max-w-lg mx-auto">
              One or more cryptographic stages failed verification. The verifier engine strictly fails closed to
              prevent forged credentials, unauthorized issuers, or revoked status proofs from being accepted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
