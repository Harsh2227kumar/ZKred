// frontend/src/features/issuer/components/CompromiseReportView.tsx
// A CompromiseReport (CONTRACTS §3.6): the on-chain cutoff, the rotated-in key, the txs, and one verdict per batch
// the key signed: anchored before the cutoff → legacy, still valid; at/after it → holders must refresh; never
// anchored → invalid (the key can no longer anchor).
import React from 'react';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import type { CompromiseReport } from '@/api/schemas';

type Verdict = CompromiseReport['affected_batches'][number]['verdict'];

export const VERDICTS: Record<Verdict, { label: string; meaning: string; cls: string }> = {
  legacy_valid: {
    label: 'Legacy: still valid',
    meaning: 'Anchored before the cutoff. Holders keep their credentials; nothing to do.',
    cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
  },
  in_window_needs_reissue: {
    label: 'In window: refresh needed',
    meaning: 'Anchored inside the compromise window. Verifiers now reject it; honest holders refresh from their wallet.',
    cls: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  },
  unanchored_invalid: {
    label: 'Unanchored: invalid',
    meaning: 'Never anchored, and the compromised key can no longer anchor. Honest holders refresh from their wallet.',
    cls: 'bg-rose-500/10 text-rose-500 border-rose-500/30',
  },
};

export const VerdictBadge: React.FC<{ verdict: Verdict }> = ({ verdict }) => (
  <span className={`inline-flex items-center text-[11px] font-medium px-2.5 py-0.5 rounded-full border whitespace-nowrap ${VERDICTS[verdict].cls}`}>
    {VERDICTS[verdict].label}
  </span>
);

export const CompromiseReportView: React.FC<{ report: CompromiseReport }> = ({ report }) => {
  const counts = (Object.keys(VERDICTS) as Verdict[]).map((v) => [v, report.affected_batches.filter((b) => b.verdict === v).length] as const);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <span className="text-muted-foreground block">Compromised from (chain time)</span>
          <span className="font-semibold text-foreground">{new Date(report.compromised_from).toLocaleString()}</span>
        </div>
        <div className="p-3 rounded-xl bg-muted/40 border border-border">
          <span className="text-muted-foreground block">Active key now</span>
          <Hex value={report.new_key.key_id} prefixLen={8} suffixLen={6} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Batches per verdict">
        {counts.map(([v, n]) => (
          <span key={v} className={`text-xs font-semibold px-3 py-1 rounded-full border ${VERDICTS[v].cls}`}>
            {n} {VERDICTS[v].label.split(':')[0]!.toLowerCase()}
          </span>
        ))}
      </div>

      {report.tx_hashes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-muted-foreground">On-chain:</span>
          {report.tx_hashes.map((h) => (
            <TxLink key={h} hash={h} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Already reported with this cutoff or an earlier one: no new transaction was needed.</p>
      )}

      {report.affected_batches.length === 0 ? (
        <p className="text-xs text-muted-foreground p-3 rounded-xl bg-muted/40">This key signed no credentials: no holder is affected.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground uppercase tracking-wider border-b border-border">
              <tr>
                <th className="p-3">Batch</th>
                <th className="p-3">Anchored at</th>
                <th className="p-3">Verdict</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.affected_batches.map((b) => (
                <tr key={b.batch_id} title={VERDICTS[b.verdict].meaning}>
                  <td className="p-3">
                    <Hex value={b.batch_id} />
                  </td>
                  <td className="p-3 text-muted-foreground whitespace-nowrap">{b.anchored_at ? new Date(b.anchored_at).toLocaleString() : '—'}</td>
                  <td className="p-3">
                    <VerdictBadge verdict={b.verdict} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
