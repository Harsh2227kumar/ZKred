// frontend/src/features/attack/components/ForgeryScoreboard.tsx
// The "wow" counter: how many forged degrees the chosen verifier accepted in its latest run, why the rest were
// rejected (by_code), and the flip against its previous run (e.g. 200 accepted → 0 accepted after the compromise).
import React from 'react';
import { ArrowRight, ShieldAlert, ShieldCheck } from 'lucide-react';
import { getStepErrorDiagnosis } from '@/components/common/step-error-diagnosis';
import type { AttackRunOut } from '@/api/schemas';

export type VerifierMode = AttackRunOut['mode'];

const MODES: { value: VerifierMode; label: string; hint: string }[] = [
  { value: 'full', label: 'ZKred full verifier', hint: 'Signature → claim → revocation → anchor time vs. the on-chain compromise cutoff' },
  { value: 'naive', label: 'Naive (signature only)', hint: 'Checks the BBS+ signature only: a stolen key makes every forgery look genuine' },
];

interface ForgeryScoreboardProps {
  /** GET /attack/state runs, newest first. */
  runs: AttackRunOut[];
  mode: VerifierMode;
  onModeChange: (mode: VerifierMode) => void;
}

export const ForgeryScoreboard: React.FC<ForgeryScoreboardProps> = ({ runs, mode, onModeChange }) => {
  const ofMode = runs.filter((r) => r.mode === mode);
  const [latest, previous] = ofMode;
  const fooled = Boolean(latest && latest.accepted > 0);
  const codes = Object.entries(latest?.by_code ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <section className="p-5 sm:p-6 rounded-3xl border border-border bg-card space-y-5" aria-live="polite">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-foreground">Forged degrees vs. the verifier</h2>
        <div role="radiogroup" aria-label="Verifier mode" className="inline-flex p-1 rounded-xl bg-muted border border-border self-start">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={mode === m.value}
              title={m.hint}
              onClick={() => onModeChange(m.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                mode === m.value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {!latest ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No {mode === 'full' ? 'full' : 'naive'} run yet. Forge some degrees, then run step 3 to score this verifier.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
          <div className={`flex items-center gap-4 ${fooled ? 'text-rose-500' : 'text-emerald-500'}`}>
            {fooled ? <ShieldAlert className="w-10 h-10 shrink-0" /> : <ShieldCheck className="w-10 h-10 shrink-0" />}
            <div>
              <div className="font-mono font-black tracking-tight leading-none text-5xl sm:text-6xl">
                {latest.accepted}
                <span className="text-2xl sm:text-3xl text-muted-foreground font-bold"> / {latest.total}</span>
              </div>
              <p className="text-xs font-semibold text-muted-foreground mt-1">
                forged accepted · <span className="text-foreground">{latest.rejected} isolated</span>
              </p>
            </div>
          </div>

          <div className="space-y-3 min-w-0">
            {previous && previous.accepted !== latest.accepted && (
              <p className="inline-flex flex-wrap items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-muted text-foreground">
                <span className={previous.accepted > 0 ? 'text-rose-500' : 'text-emerald-500'}>{previous.accepted} accepted</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className={latest.accepted > 0 ? 'text-rose-500' : 'text-emerald-500'}>{latest.accepted} accepted</span>
                <span className="text-muted-foreground font-normal">since the previous {mode} run</span>
              </p>
            )}
            {codes.length > 0 ? (
              <ul className="space-y-2">
                {codes.map(([code, n]) => (
                  <li key={code} className="space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-x-3 gap-y-0.5 text-xs">
                      <span className="text-foreground font-medium" title={code}>
                        {getStepErrorDiagnosis(code).title}
                      </span>
                      <span className="font-mono text-muted-foreground break-all sm:shrink-0">
                        {code} × {n}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${(n / latest.total) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                {MODES.find((m) => m.value === mode)!.hint}. {fooled ? 'Every forgery passed.' : ''}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">Last run {new Date(latest.ran_at).toLocaleTimeString()}</p>
          </div>
        </div>
      )}
    </section>
  );
};
