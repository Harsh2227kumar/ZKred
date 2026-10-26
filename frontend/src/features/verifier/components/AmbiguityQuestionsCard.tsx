// frontend/src/features/verifier/components/AmbiguityQuestionsCard.tsx
import React, { useState } from 'react';
import {
  HelpCircle,
  AlertTriangle,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Sparkles,
} from 'lucide-react';

interface AmbiguityQuestionsCardProps {
  questions: string[];
  currentPrompt: string;
  onRetry: (refinedPrompt: string) => void;
  onOpenManualBuilder: () => void;
  isCompiling?: boolean;
}

const QUICK_CLARIFICATIONS = [
  { label: '+ Accredited MBBS Degree', text: ' Requires accredited MBBS Degree from an accredited university.' },
  { label: '+ Age ≥ 21 Years', text: ' Must be at least 21 years of age proven with zero-knowledge.' },
  { label: '+ Active Medical License', text: ' Candidate must possess an active Medical License.' },
  { label: '+ Withhold All PII', text: ' Strictly do not collect holder name, date of birth, or address.' },
];

export const AmbiguityQuestionsCard: React.FC<AmbiguityQuestionsCardProps> = ({
  questions,
  currentPrompt,
  onRetry,
  onOpenManualBuilder,
  isCompiling = false,
}) => {
  const [refinedText, setRefinedText] = useState(currentPrompt);

  const handleAppendSuggestion = (addon: string) => {
    setRefinedText((prev) => `${prev.trim()}${addon}`);
  };

  return (
    <div className="p-6 rounded-3xl border border-amber-500/40 bg-linear-to-b from-amber-500/10 via-[#130e24] to-[#130e24] space-y-5 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-500/20 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-[#f0f7f7]">
                Requirement Ambiguity Detected
              </h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                422 POLICY_AMBIGUOUS
              </span>
            </div>
            <p className="text-xs text-[#8ea5a8] mt-0.5">
              The AI model could not construct a safe zero-knowledge policy without clarification.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenManualBuilder}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-[#79bab6] hover:text-[#f0f7f7] bg-[#090614] border border-[#231a3d] hover:border-[#79bab6] transition-colors self-start sm:self-auto cursor-pointer"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Switch to Visual Builder</span>
        </button>
      </div>

      {/* AI Questions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-300">
          <HelpCircle className="w-4 h-4" />
          <span>Clarifying questions returned by Claude on Bedrock:</span>
        </div>
        <div className="space-y-1.5">
          {questions.map((q, idx) => (
            <div
              key={idx}
              className="p-3 rounded-2xl bg-[#090614]/80 border border-amber-500/30 flex items-start gap-2.5 text-xs text-[#f0f7f7]"
            >
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-300 font-mono text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                {idx + 1}
              </span>
              <span className="leading-relaxed font-medium">{q}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Add Suggestions */}
      <div className="space-y-2 pt-1">
        <span className="text-[11px] text-[#8ea5a8] block">
          One-click prompt refinements to resolve ambiguity:
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_CLARIFICATIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleAppendSuggestion(item.text)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs bg-[#130e24] hover:bg-[#06838d]/20 text-[#79bab6] border border-[#231a3d] hover:border-[#06838d]/50 transition-colors cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Refined Text Area & Retry Button */}
      <div className="space-y-3 pt-2 border-t border-[#231a3d]">
        <label className="block space-y-1.5">
          <span className="text-xs font-semibold text-[#f0f7f7] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#79bab6]" />
            <span>Refine Requirement Text & Retry</span>
          </span>
          <textarea
            rows={3}
            value={refinedText}
            onChange={(e) => setRefinedText(e.target.value)}
            className="w-full p-3.5 rounded-2xl border border-[#231a3d] bg-[#090614] text-xs text-[#f0f7f7] focus:border-[#79bab6] focus:outline-hidden"
            placeholder="Clarify specific degree, accreditation, and minimum age criteria..."
          />
        </label>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] text-[#8ea5a8]">
            Feeds revised requirement back to Claude with forced Zod validation
          </span>
          <button
            type="button"
            disabled={isCompiling || !refinedText.trim()}
            onClick={() => onRetry(refinedText.trim())}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#06838d] hover:bg-[#046168] text-white transition-colors disabled:opacity-50 cursor-pointer shadow-md"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isCompiling ? 'animate-spin' : ''}`} />
            <span>{isCompiling ? 'Re-compiling...' : 'Retry Compilation'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
