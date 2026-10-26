// frontend/src/features/verifier/components/PolicyPromptTemplates.tsx
import React from 'react';
import { Sparkles, Stethoscope, GraduationCap, HelpCircle } from 'lucide-react';

interface PromptTemplate {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  text: string;
  tag?: string;
}

const TEMPLATES: PromptTemplate[] = [
  {
    id: 'canonical-doctor',
    label: 'Hospital Doctor (Canonical)',
    icon: Stethoscope,
    description: 'Accredited MBBS degree + Age ≥ 21 without revealing name, DOB, or address',
    text: 'Verify the candidate holds an accredited MBBS Degree and is at least 21 years old. Do not collect their name, date of birth, or home address.',
    tag: 'Judge Demo',
  },
  {
    id: 'tech-engineer',
    label: 'Tech Hiring (B.Tech)',
    icon: GraduationCap,
    description: 'Accredited B.Tech degree with grade and graduation year disclosed',
    text: 'Verify the candidate holds an accredited B.Tech Degree from an accredited engineering university. Reveal only degree_name and grade; do not collect personal identifiers.',
  },
  {
    id: 'ambiguous-test',
    label: 'Ambiguity Test',
    icon: HelpCircle,
    description: 'Triggers Claude POLICY_AMBIGUOUS clarifying questions flow',
    text: 'Verify that this person has qualifications and is allowed to work in the country.',
    tag: 'Test 422',
  },
];

interface PolicyPromptTemplatesProps {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export const PolicyPromptTemplates: React.FC<PolicyPromptTemplatesProps> = ({
  onSelect,
  disabled = false,
}) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#8ea5a8]">
        <Sparkles className="w-3 h-3 text-[#79bab6]" />
        <span>One-Click Evaluation Templates:</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {TEMPLATES.map((tmpl) => {
          const Icon = tmpl.icon;
          return (
            <button
              key={tmpl.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(tmpl.text)}
              className="p-3 rounded-2xl border border-[#231a3d] bg-[#090614] hover:bg-[#130e24] hover:border-[#06838d]/50 transition-all text-left flex flex-col justify-between group disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#f0f7f7] group-hover:text-[#79bab6] transition-colors">
                    <Icon className="w-3.5 h-3.5 text-[#79bab6]" />
                    <span>{tmpl.label}</span>
                  </div>
                  {tmpl.tag && (
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-full bg-[#06838d]/15 text-[#79bab6] border border-[#06838d]/30">
                      {tmpl.tag}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#8ea5a8] leading-snug line-clamp-2">
                  {tmpl.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
