// frontend/src/features/verifier/pages/VerifierPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  SlidersHorizontal,
  Send,
  Building2,
  Plus,
  Sparkles,
  Info,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import { useVerifiers, useParsePolicy } from '@/api/queries/verifiers';
import { CreateVerifierModal } from '../components/CreateVerifierModal';
import { ManualPolicyBuilder } from '../components/ManualPolicyBuilder';
import type { PresentationPolicy, PresentationRequest } from '@/api/schemas';
import { toast } from 'sonner';

export const VerifierPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: verifiersData, isLoading: isLoadingVerifiers } = useVerifiers();
  const parsePolicyMutation = useParsePolicy();

  const [selectedVerifierId, setSelectedVerifierId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [compilerNotice, setCompilerNotice] = useState<string | null>(null);
  const [compiledPolicy, setCompiledPolicy] = useState<PresentationPolicy | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const verifiers = verifiersData?.items || [];
  const activeVerifierId = selectedVerifierId || verifiers[0]?.id || '';

  const handleCompilePolicy = async () => {
    if (!naturalLanguage.trim()) {
      toast.error('Please enter policy requirements before compiling');
      return;
    }

    setIsCompiling(true);
    setCompilerNotice(null);

    try {
      const result = await parsePolicyMutation.mutateAsync({
        text: naturalLanguage.trim(),
      });

      setCompiledPolicy(result.policy);
      setCompilerNotice(`AI compiled: "${result.consent_summary}"`);
      toast.success('Zero-knowledge policy compiled successfully');
    } catch (err: unknown) {
      // In V1, POST /presentation-requests/parse returns 501 Not Implemented or 502
      console.warn('AI Policy compiler returned error or 501 in V1:', err);
      setCompilerNotice(
        'Natural Language Bedrock compiler is staged for V1.1. Visual Policy Builder is fully active below.'
      );
      toast.info('Visual Policy Builder enabled for manual configuration');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRequestCreated = (request: PresentationRequest) => {
    navigate(`/verifier/requests/${request.id}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
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
            Build zero-knowledge selective disclosure requests and verify student credentials without collecting PII.
          </p>
        </div>

        {/* Verifier Department Selector */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#231a3d] bg-[#130e24]">
            <Building2 className="w-4 h-4 text-[#79bab6]" />
            <select
              value={activeVerifierId}
              onChange={(e) => setSelectedVerifierId(e.target.value)}
              disabled={isLoadingVerifiers || verifiers.length === 0}
              className="bg-transparent text-xs text-[#f0f7f7] focus:outline-hidden cursor-pointer"
            >
              {verifiers.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#130e24] text-[#f0f7f7]">
                  {v.name}
                </option>
              ))}
              {verifiers.length === 0 && (
                <option value="" className="bg-[#130e24] text-[#8ea5a8]">
                  {isLoadingVerifiers ? 'Loading departments...' : 'No Verifier Department'}
                </option>
              )}
            </select>
          </div>

          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#06838d] hover:bg-[#046168] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Verifier</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Policy Compiler & Manual Builder */}
      <div className="grid grid-cols-1 gap-6">
        {/* Natural Language Compiler */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-4">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
              <Sparkles className="w-4 h-4 text-[#79bab6]" />
              <span>Natural Language Policy Compiler</span>
            </div>
            <span className="text-[11px] font-mono text-[#8ea5a8]">POST /presentation-requests/parse</span>
          </div>

          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Describe required candidate qualifications in plain English. The compiler interprets criteria into a zero-knowledge selective disclosure specification.
          </p>

          <textarea
            rows={3}
            value={naturalLanguage}
            onChange={(e) => setNaturalLanguage(e.target.value)}
            className="w-full p-4 rounded-2xl border border-[#231a3d] bg-[#090614] text-sm text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
            placeholder="e.g. Verify the student holds an accredited Degree and is at least 21 years of age, without revealing their name, DOB, or physical address."
          />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-[#8ea5a8]">
              Targeting Bedrock Claude Sonnet zero-knowledge translator
            </span>
            <button
              type="button"
              onClick={handleCompilePolicy}
              disabled={isCompiling}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-medium bg-[#06838d] hover:bg-[#046168] text-white transition-colors disabled:opacity-50"
            >
              {isCompiling ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Compiling...</span>
                </>
              ) : (
                <>
                  <span>Compile with AI</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>

          {/* Compiler Notice / Fallback Banner */}
          {compilerNotice && (
            <div className="p-3.5 rounded-xl border border-[#06838d]/30 bg-[#06838d]/10 flex items-start gap-2.5 text-xs text-[#79bab6]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{compilerNotice}</span>
            </div>
          )}
        </div>

        {/* Visual Policy Specification & Builder */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#79bab6]" />
              <h3 className="text-sm font-semibold text-[#f0f7f7]">Zero-Knowledge Policy Specification</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#79bab6]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Privacy-by-Design Guardrails Active</span>
            </div>
          </div>

          <ManualPolicyBuilder
            verifierId={activeVerifierId}
            initialPolicy={compiledPolicy}
            nlPrompt={naturalLanguage}
            onSuccess={handleRequestCreated}
          />
        </div>
      </div>

      {/* Department Creation Modal */}
      <CreateVerifierModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={(verifierId) => {
          setSelectedVerifierId(verifierId);
          setIsCreateModalOpen(false);
        }}
      />
    </div>
  );
};
