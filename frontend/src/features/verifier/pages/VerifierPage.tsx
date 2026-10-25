import React, { useState } from 'react';
import { CheckCircle2, SlidersHorizontal, Send, ShieldCheck } from 'lucide-react';

export const VerifierPage: React.FC = () => {
  const [naturalLanguage, setNaturalLanguage] = useState('');

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Verification Portal</h1>
          </div>
          <p className="text-sm text-[#8ea5a8] mt-1">
            Specify student credential criteria or generate custom zero-knowledge verification policies.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: NL Request Form */}
        <div className="lg:col-span-2 p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
            <SlidersHorizontal className="w-4 h-4 text-[#79bab6]" />
            <span>Policy Requirement Compiler</span>
          </div>
          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Enter required qualifications in plain language. The compiler translates criteria into a zero-knowledge selective disclosure proof specification.
          </p>

          <textarea
            rows={4}
            value={naturalLanguage}
            onChange={(e) => setNaturalLanguage(e.target.value)}
            className="w-full p-4 rounded-2xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
            placeholder="e.g. Verify that the candidate has an accredited Computer Science degree and is currently enrolled, without revealing their home address, student ID, or exact grades."
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#8ea5a8] font-mono">
              Target: <span className="bg-[#1a1430] px-2 py-0.5 rounded-md text-[#f0f7f7]">POST /api/v1/presentation-requests/parse</span>
            </span>
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium bg-[#06838d]/40 text-white cursor-not-allowed"
            >
              <span>Compile Request (Available in V1)</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Right: Active Presentation Requests */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Active Requests</h3>
            <span className="text-xs text-[#79bab6]">Feed</span>
          </div>
          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Verification requests issued by your department and real-time validation logs.
          </p>
          <div className="p-6 rounded-2xl border border-dashed border-[#231a3d] text-center text-xs text-[#8ea5a8] space-y-1">
            <ShieldCheck className="w-6 h-6 text-[#8ea5a8] mx-auto opacity-40 mb-2" />
            <p>No active verification requests.</p>
            <p className="text-[11px] opacity-75">Compile a policy to generate a student QR prompt.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
