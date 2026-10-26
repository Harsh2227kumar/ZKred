// frontend/src/features/issuer/components/CompromiseDialog.tsx
// "Report compromise" (CONTRACTS §3.2): marks the key compromised on-chain from (chain time − window), rotates an
// active key, and shows the CompromiseReport. The window defaults to GET /meta/chain.breach_window_seconds.
import React, { useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, Loader2, ShieldAlert, X } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import { useReportCompromise } from '@/api/queries/issuers';
import { useChainInfo } from '@/api/queries/meta';
import type { CompromiseReport } from '@/api/schemas';
import { CompromiseReportView, VERDICTS } from './CompromiseReportView';

/** CompromiseCreate.window_seconds upper bound (CONTRACTS changelog V1.2-H2: ≤ 10 years). */
const MAX_WINDOW_SECONDS = 10 * 365 * 24 * 3600;
const UNITS = [
  { value: 86400, label: 'days' },
  { value: 3600, label: 'hours' },
  { value: 60, label: 'minutes' },
  { value: 1, label: 'seconds' },
] as const;

/** The largest unit that expresses `seconds` exactly, so the default reads "48 hours", not "172800 seconds". */
function bestUnit(seconds: number): number {
  return UNITS.find((u) => seconds % u.value === 0)?.value ?? 1;
}

export function formatWindow(seconds: number): string {
  const unit = UNITS.find((u) => u.value === bestUnit(seconds))!;
  const n = seconds / unit.value;
  return `${n} ${n === 1 ? unit.label.slice(0, -1) : unit.label}`;
}

interface CompromiseDialogProps {
  issuerId: string;
  keyId: string;
  /** Re-reporting an already compromised key can only move its cutoff earlier. */
  alreadyCompromised: boolean;
  onClose: () => void;
  onReported: (report: CompromiseReport) => void;
}

export const CompromiseDialog: React.FC<CompromiseDialogProps> = ({ issuerId, keyId, alreadyCompromised, onClose, onReported }) => {
  const chain = useChainInfo();
  const report = useReportCompromise(issuerId);
  const defaultWindow = chain.data?.breach_window_seconds ?? 0;
  const [amount, setAmount] = useState<number | null>(null);
  const [unit, setUnit] = useState<number | null>(null);
  const [result, setResult] = useState<CompromiseReport | null>(null);

  const effectiveUnit = unit ?? bestUnit(defaultWindow || 1);
  const effectiveAmount = amount ?? (defaultWindow ? defaultWindow / effectiveUnit : NaN);
  const windowSeconds = effectiveAmount * effectiveUnit;
  const windowValid = Number.isInteger(windowSeconds) && windowSeconds > 0 && windowSeconds <= MAX_WINDOW_SECONDS;

  const submit = () =>
    report.mutate(
      { keyId, windowSeconds },
      {
        onSuccess: (r) => {
          setResult(r);
          onReported(r);
          toast.success('Compromise recorded on-chain');
        },
        onError: (err) => toast.error(toUserMessage(err)),
      },
    );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="compromise-title">
      <div className="bg-card border border-border p-5 sm:p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <h3 id="compromise-title" className="text-lg font-bold text-foreground">
              {result ? 'Compromise report' : 'Report key compromise'}
            </h3>
          </div>
          <button type="button" onClick={onClose} disabled={report.isPending} aria-label="Close" className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <>
            <CompromiseReportView report={result} />
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground">
                Done
              </button>
            </div>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (windowValid) submit();
            }}
          >
            <p className="text-xs text-muted-foreground leading-relaxed">
              Key <Hex value={keyId} /> is marked compromised from <strong className="text-foreground">chain time − window</strong>. The
              chain timestamps every batch anchor, so this one transaction sorts every credential the key signed:
            </p>
            <ul className="space-y-1.5">
              {Object.values(VERDICTS).map((v) => (
                <li key={v.label} className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 text-xs">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full border font-medium ${v.cls}`}>{v.label}</span>
                  <span className="text-muted-foreground">{v.meaning}</span>
                </li>
              ))}
            </ul>
            {alreadyCompromised && (
              <p className="text-xs p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
                This key is already compromised. Reporting again can only move its cutoff earlier (a wider window); a narrower window keeps the
                current cutoff.
              </p>
            )}

            {chain.isLoading ? (
              <p className="text-xs text-muted-foreground">Loading the default window…</p>
            ) : (
              <fieldset className="space-y-1">
                <legend className="text-xs font-medium text-foreground">Compromise window (before now)</legend>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    required
                    aria-label="Window length"
                    value={Number.isNaN(effectiveAmount) ? '' : effectiveAmount}
                    onChange={(e) => setAmount(e.target.valueAsNumber)}
                    className="w-32 px-3 py-2 text-sm rounded-lg border border-border bg-background font-mono"
                  />
                  <select
                    aria-label="Window unit"
                    value={effectiveUnit}
                    onChange={(e) => {
                      setAmount(effectiveAmount);
                      setUnit(Number(e.target.value));
                    }}
                    className="px-3 py-2 text-sm rounded-lg border border-border bg-background"
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <span className={`text-[11px] ${windowValid ? 'text-muted-foreground' : 'text-rose-500'}`}>
                  {windowValid
                    ? `Cutoff = chain time − ${formatWindow(windowSeconds)}.`
                    : `Enter a whole number of seconds between 1 and ${formatWindow(MAX_WINDOW_SECONDS)}.`}{' '}
                  {defaultWindow > 0 && `Server default: ${formatWindow(defaultWindow)}.`}
                </span>
              </fieldset>
            )}

            {report.error != null && (
              <p className="flex items-start gap-2 text-xs p-2.5 rounded-lg bg-destructive/10 text-destructive">
                <AlertCircle className="w-4 h-4 shrink-0" /> {toUserMessage(report.error)} Nothing was changed.
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={report.isPending} className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={report.isPending || !windowValid || chain.isLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-600/90 disabled:opacity-50"
              >
                {report.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {report.isPending ? 'Recording on-chain…' : 'Mark compromised'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
