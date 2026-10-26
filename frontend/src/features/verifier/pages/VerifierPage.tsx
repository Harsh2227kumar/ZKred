// frontend/src/features/verifier/pages/VerifierPage.tsx
import React, { useState, useRef } from 'react';
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
import { useVerifiers, useParsePolicy, useCreateRequest } from '@/api/queries/verifiers';
import { CreateVerifierModal } from '../components/CreateVerifierModal';
import { ManualPolicyBuilder } from '../components/ManualPolicyBuilder';
import { PolicyPromptTemplates } from '../components/PolicyPromptTemplates';
import { AmbiguityQuestionsCard } from '../components/AmbiguityQuestionsCard';
import { CompiledPolicyChips } from '../components/CompiledPolicyChips';
import type { ParseOut, PresentationRequest } from '@/api/schemas';
import { toast } from 'sonner';

export const VerifierPage: React.FC = () => {
  const navigate = useNavigate();
  const builderSectionRef = useRef<HTMLDivElement>(null);

  const { data: verifiersData, isLoading: isLoadingVerifiers } = useVerifiers();
  const parsePolicyMutation = useParsePolicy();
  const createRequestMutation = useCreateRequest();

  const [selectedVerifierId, setSelectedVerifierId] = useState<string>('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [naturalLanguage, setNaturalLanguage] = useState('');
  const [compilerNotice, setCompilerNotice] = useState<string | null>(null);
  const [compiledResult, setCompiledResult] = useState<ParseOut | null>(null);
  const [ambiguityQuestions, setAmbiguityQuestions] = useState<string[] | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [isPublishingDirect, setIsPublishingDirect] = useState(false);

  const verifiers = verifiersData?.items || [];
  const activeVerifierId = selectedVerifierId || verifiers[0]?.id || '';

  const handleCompilePolicy = async (textToCompile?: string) => {
    const text = (textToCompile ?? naturalLanguage).trim();
    if (!text) {
      toast.error('Please enter policy requirements before compiling');
      return;
    }

    setIsCompiling(true);
    setCompilerNotice(null);
    setAmbiguityQuestions(null);

    try {
      const result = await parsePolicyMutation.mutateAsync({ text });
      setCompiledResult(result);
      toast.success('Zero-knowledge policy compiled successfully');
    } catch (err: unknown) {
      const errorObj = err as {
        error?: {
          code?: string;
          message?: string;
          details?: { questions?: string[] };
        };
      };

      const errCode = errorObj?.error?.code;

      if (errCode === 'POLICY_AMBIGUOUS') {
        const questions =
          errorObj?.error?.details?.questions && errorObj.error.details.questions.length > 0
            ? errorObj.error.details.questions
            : ['Which credential and which facts should the holder prove?'];
        setAmbiguityQuestions(questions);
        setCompiledResult(null);
        toast.warning('Clarification needed: requirement is ambiguous');
      } else if (errCode === 'AI_UNAVAILABLE') {
        setCompiledResult(null);
        setCompilerNotice(
          'AWS Bedrock AI is currently unavailable; you can configure all zero-knowledge constraints manually in the Visual Policy Builder below.'
        );
        toast.info('Visual Policy Builder active for manual configuration');
      } else if (errCode === 'AI_BAD_OUTPUT') {
        setCompiledResult(null);
        setCompilerNotice(
          'The AI model could not construct a conforming policy. Try rephrasing with specific credential types or use the Visual Policy Builder below.'
        );
        toast.error('AI could not produce a valid policy schema');
      } else {
        setCompiledResult(null);
        setCompilerNotice(
          errorObj?.error?.message || 'Policy compilation encountered an issue. Manual builder is active below.'
        );
      }
    } finally {
      setIsCompiling(false);
    }
  };

  const handlePublishCompiled = async () => {
    if (!compiledResult || !activeVerifierId) {
      toast.error('Please select an authorized verifier department first');
      return;
    }

    setIsPublishingDirect(true);
    try {
      const newRequest = await createRequestMutation.mutateAsync({
        verifier_id: activeVerifierId,
        policy: compiledResult.policy,
        nl_text: naturalLanguage.trim() || null,
      });

      toast.success('Presentation request created successfully');
      navigate(`/verifier/requests/${newRequest.id}`);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ||
        'Failed to create presentation request';
      toast.error(message);
    } finally {
      setIsPublishingDirect(false);
    }
  };

  const handleEditInVisualBuilder = () => {
    builderSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast.info('Policy loaded into Visual Policy Builder for fine-tuning');
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
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">
              Verification Portal
            </h1>
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-[#06838d] hover:bg-[#046168] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Verifier</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Policy Compiler & Manual Builder */}
      <div className="grid grid-cols-1 gap-6">
        {/* Natural Language Compiler */}
        <div className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-5">
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#f0f7f7]">
              <Sparkles className="w-4 h-4 text-[#79bab6]" />
              <span>Natural Language Policy Compiler</span>
            </div>
            <span className="text-[11px] font-mono text-[#8ea5a8]">
              Powered by Claude Sonnet on AWS Bedrock
            </span>
          </div>

          <p className="text-xs text-[#8ea5a8] leading-relaxed">
            Describe required candidate qualifications in plain English. The compiler interprets criteria into a zero-knowledge selective disclosure specification with mathematical privacy guardrails.
          </p>

          {/* Quick-fill template prompts */}
          <PolicyPromptTemplates
            disabled={isCompiling}
            onSelect={(text) => {
              setNaturalLanguage(text);
              handleCompilePolicy(text);
            }}
          />

          <div className="space-y-2">
            <textarea
              rows={3}
              value={naturalLanguage}
              onChange={(e) => setNaturalLanguage(e.target.value)}
              className="w-full p-4 rounded-2xl border border-[#231a3d] bg-[#090614] text-xs text-[#f0f7f7] placeholder-[#8ea5a8] focus:border-[#79bab6] focus:outline-hidden"
              placeholder="e.g. Verify the candidate holds an accredited MBBS Degree and is at least 21 years of age, without collecting their name, DOB, or home address."
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
              <span className="text-[11px] text-[#8ea5a8]">
                Enforces zero-knowledge data minimisation rules automatically
              </span>
              <button
                type="button"
                onClick={() => handleCompilePolicy()}
                disabled={isCompiling}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#06838d] hover:bg-[#046168] text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md"
              >
                {isCompiling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Compiling with Bedrock...</span>
                  </>
                ) : (
                  <>
                    <span>Compile with AI</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Ambiguity Handling Card (if 422 returned) */}
          {ambiguityQuestions && (
            <AmbiguityQuestionsCard
              questions={ambiguityQuestions}
              currentPrompt={naturalLanguage}
              isCompiling={isCompiling}
              onRetry={(refinedText) => {
                setNaturalLanguage(refinedText);
                handleCompilePolicy(refinedText);
              }}
              onOpenManualBuilder={handleEditInVisualBuilder}
            />
          )}

          {/* Compiler Notice / Fallback Banner */}
          {compilerNotice && (
            <div className="p-4 rounded-2xl border border-[#06838d]/30 bg-[#06838d]/10 flex items-start gap-2.5 text-xs text-[#79bab6]">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-semibold block">Compiler Notice</span>
                <span>{compilerNotice}</span>
              </div>
            </div>
          )}

          {/* Compiled Policy Chips Display */}
          {compiledResult && (
            <CompiledPolicyChips
              policy={compiledResult.policy}
              consentSummary={compiledResult.consent_summary}
              minimisationNotes={compiledResult.minimisation_notes}
              onPublishNow={handlePublishCompiled}
              onEditInBuilder={handleEditInVisualBuilder}
              isPublishing={isPublishingDirect}
            />
          )}
        </div>

        {/* Visual Policy Specification & Builder */}
        <div
          ref={builderSectionRef}
          className="p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-6"
        >
          <div className="flex items-center justify-between border-b border-[#231a3d] pb-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-[#79bab6]" />
              <h3 className="text-sm font-semibold text-[#f0f7f7]">
                Visual Policy Builder & Advanced Customization
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[#79bab6]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Full Manual Controls Active</span>
            </div>
          </div>

          <ManualPolicyBuilder
            verifierId={activeVerifierId}
            initialPolicy={compiledResult?.policy}
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
