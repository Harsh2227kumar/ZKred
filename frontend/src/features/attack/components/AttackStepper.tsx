// frontend/src/features/attack/components/AttackStepper.tsx
// The red-team storyline as a 3-step stepper: each step shows whether it is done, current or still locked.
import React from 'react';
import { Check, Lock } from 'lucide-react';

export type StepStatus = 'done' | 'current' | 'locked';

export interface AttackStep {
  title: string;
  description: string;
  status: StepStatus;
  content: React.ReactNode;
}

const badge: Record<StepStatus, string> = {
  done: 'bg-emerald-500 text-white border-emerald-500',
  current: 'bg-rose-600 text-white border-rose-600',
  locked: 'bg-muted text-muted-foreground border-border',
};

export const AttackStepper: React.FC<{ steps: AttackStep[] }> = ({ steps }) => (
  <ol className="grid grid-cols-1 lg:grid-cols-3 gap-4">
    {steps.map((step, i) => (
      <li
        key={step.title}
        aria-current={step.status === 'current' ? 'step' : undefined}
        className={`p-4 rounded-2xl border bg-card space-y-3 transition-opacity ${
          step.status === 'current' ? 'border-rose-500/50 shadow-sm' : 'border-border'
        } ${step.status === 'locked' ? 'opacity-60' : ''}`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center text-xs font-bold ${badge[step.status]}`}>
            {step.status === 'done' ? <Check className="w-4 h-4" /> : step.status === 'locked' ? <Lock className="w-3.5 h-3.5" /> : i + 1}
          </span>
          <div className="min-w-0">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Step {i + 1}</span>
            <h4 className="text-sm font-semibold text-foreground leading-tight">{step.title}</h4>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
        {step.content}
      </li>
    ))}
  </ol>
);
