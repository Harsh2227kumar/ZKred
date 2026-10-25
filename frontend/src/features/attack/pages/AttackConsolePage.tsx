import React from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Play } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';

export const AttackConsolePage: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <KeyRound className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Key Security & Audit</h1>
          </div>
          <p className="text-sm text-[#8ea5a8] mt-1">
            Audit institutional key compromise scenarios and verify that legitimate student degrees remain safe.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#130e24] text-[#79bab6] border border-[#06838d]/30 text-xs font-medium">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Security Audit Sandbox</span>
        </div>
      </div>

      {/* Comparison Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Full ZK Verifier (Our System) */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4.5 h-4.5 text-[#79bab6]" />
              <h3 className="text-sm font-semibold text-[#f0f7f7]">ZKred Epoch-Anchored Protocol</h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#06838d]/15 text-[#79bab6] border border-[#06838d]/30 font-medium">
              Protected
            </span>
          </div>

          <div className="py-4 text-center">
            <span className="text-4xl font-semibold text-[#79bab6] font-mono">0</span>
            <span className="text-xs text-[#8ea5a8] block mt-1.5">
              Forged degrees accepted after compromise
            </span>
          </div>

          <p className="text-xs text-[#8ea5a8] text-center leading-relaxed">
            Batch roots anchored after key revocation are automatically rejected. Legitimate degrees issued prior to compromise remain 100% valid.
          </p>
        </div>

        {/* Naive Verifier (Traditional Systems) */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4.5 h-4.5 text-[#ff453a]" />
              <h3 className="text-sm font-semibold text-[#f0f7f7]">Conventional Signature Verification</h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/20 font-medium">
              Vulnerable
            </span>
          </div>

          <div className="py-4 text-center">
            <span className="text-4xl font-semibold text-[#ff453a] font-mono">ALL</span>
            <span className="text-xs text-[#8ea5a8] block mt-1.5">
              Forged certificates accepted
            </span>
          </div>

          <p className="text-xs text-[#8ea5a8] text-center leading-relaxed">
            Standard systems only check the mathematical signature. If an admin key is leaked, attackers can backdate unlimited counterfeit diplomas.
          </p>
        </div>
      </div>

      {/* 3-Step Simulation Stepper */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-5">
        <div className="border-b border-[#231a3d] pb-3">
          <h3 className="text-sm font-semibold text-[#f0f7f7]">Security Verification Procedure</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-[#8ea5a8]">Phase 1</span>
            <h4 className="text-xs font-semibold text-[#f0f7f7]">Simulate Key Extraction</h4>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">Simulates an unauthorized entity obtaining the institution's private signing key.</p>
          </div>

          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-[#8ea5a8]">Phase 2</span>
            <h4 className="text-xs font-semibold text-[#f0f7f7]">Attempt Fraudulent Issuance</h4>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">Attempts to forge 200 degrees and anchor them on <ChainName />.</p>
          </div>

          <div className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2">
            <span className="text-[10px] uppercase tracking-wider text-[#8ea5a8]">Phase 3</span>
            <h4 className="text-xs font-semibold text-[#f0f7f7]">On-Chain Quarantine</h4>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">The contract cutoff isolates counterfeit batches while honest student records stay intact.</p>
          </div>
        </div>

        <div className="pt-2 flex items-center justify-end">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium bg-[#06838d]/40 text-white cursor-not-allowed"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Run Security Audit (Staged for V1.2)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
