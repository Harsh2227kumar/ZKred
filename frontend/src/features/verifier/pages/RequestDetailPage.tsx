import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { ArrowLeft, Clock, ShieldCheck, Lock } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { useEnums } from '@/api/queries/meta';

export const RequestDetailPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const { data: enums } = useEnums();

  const evalChainNodes = (enums?.verification_steps ?? []).map((step, i) => ({
    id: i + 1,
    title: `${i + 1}. ${step.label}`,
  }));

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <NavLink to="/verifier" className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Verification Portal
      </NavLink>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Verification Evaluation</h1>
          <div className="flex items-center gap-2 mt-1.5 text-xs text-[#8ea5a8]">
            <span>Request ID:</span>
            <Hex value={requestId || ''} />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#130e24] text-[#79bab6] border border-[#06838d]/30 text-xs font-medium">
          <Clock className="w-3.5 h-3.5 animate-spin" />
          <span>Awaiting Student Submission</span>
        </div>
      </div>

      {/* Evaluation Chain Visualizer */}
      <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-5">
        <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4.5 h-4.5 text-[#79bab6]" />
            <h3 className="text-sm font-semibold text-[#f0f7f7]">Zero-Knowledge Pipeline Stages</h3>
          </div>
          <span className="text-xs text-[#8ea5a8]">Deterministic Validation</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {evalChainNodes.map((node) => (
            <div
              key={node.id}
              className="p-4 rounded-2xl border border-[#231a3d] bg-[#090614] space-y-2 flex flex-col justify-between"
            >
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#8ea5a8] block mb-1">STAGE {node.id}</span>
                <h4 className="text-xs font-medium text-[#f0f7f7]">{node.title}</h4>
              </div>
              <div className="pt-3 border-t border-[#231a3d] flex items-center gap-1.5 text-xs text-[#8ea5a8]">
                <Clock className="w-3 h-3 text-[#8ea5a8]" />
                <span>Pending proof</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Prominent Data Minimization Security Card */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] flex items-start gap-4">
        <div className="p-2.5 rounded-2xl bg-[#06838d]/15 text-[#79bab6] shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-[#f0f7f7]">Student Privacy Guarantee</h4>
          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            This verification engine will <strong>never receive or store</strong> the student's full legal name, date of birth, or home address.
            Verification succeeds strictly through cryptographic BBS+ blinding and Groth16 zero-knowledge range proofs.
          </p>
        </div>
      </div>
    </div>
  );
};
