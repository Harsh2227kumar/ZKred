import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import { toUserMessage } from '@/api/client';
import { useReportCompromise } from '@/api/queries/issuers';
import { useChainInfo } from '@/api/queries/meta';
import type { CompromiseReport } from '@/api/schemas';

const verdictStyle: Record<string, { label: string; cls: string }> = {
  legacy_valid: { label: 'Legacy: still valid', cls: 'bg-emerald-500/10 text-emerald-500' },
  in_window_needs_reissue: { label: 'In window: holders must refresh', cls: 'bg-amber-500/10 text-amber-500' },
  unanchored_invalid: { label: 'Unanchored: invalid', cls: 'bg-rose-500/10 text-rose-500' },
};

export const CompromiseDialog: React.FC<{ issuerId: string; keyId: string; onClose: () => void }> = ({ issuerId, keyId, onClose }) => {
  const { data: chain } = useChainInfo();
  const report = useReportCompromise(issuerId);
  const [windowSeconds, setWindowSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<CompromiseReport | null>(null);
  const effectiveWindow = windowSeconds ?? chain?.breach_window_seconds ?? 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border p-6 rounded-2xl max-w-2xl w-full space-y-4 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          <h3 className="text-lg font-bold text-foreground">Report key compromise</h3>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>
            Key <Hex value={keyId} /> is marked compromised from <strong>chain time − window</strong>. Batches anchored before that cutoff
            stay valid; batches anchored after it are rejected, and an active key is rotated automatically.
          </p>
        </div>

        {!result ? (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              report.mutate(
                { keyId, windowSeconds: effectiveWindow },
                {
                  onSuccess: (r) => {
                    setResult(r);
                    toast.success('Compromise recorded on-chain');
                  },
                  onError: (err) => toast.error(toUserMessage(err)),
                },
              );
            }}
          >
            <label className="block space-y-1">
              <span className="text-xs font-medium text-foreground">Compromise window (seconds before now)</span>
              <input
                type="number"
                min={1}
                required
                value={effectiveWindow || ''}
                onChange={(e) => setWindowSeconds(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background font-mono"
              />
              <span className="text-[11px] text-muted-foreground">
                ≈ {(effectiveWindow / 3600).toFixed(2)} h. Default from the server: {chain?.breach_window_seconds ?? '…'} s.
              </span>
            </label>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} disabled={report.isPending} className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted">
                Cancel
              </button>
              <button
                type="submit"
                disabled={report.isPending || !effectiveWindow}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-600/90 disabled:opacity-50"
              >
                {report.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Mark compromised
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block">Compromised from (chain time)</span>
                <span className="font-semibold text-foreground">{new Date(result.compromised_from).toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-lg bg-muted/40">
                <span className="text-muted-foreground block">New active key</span>
                <Hex value={result.new_key.key_id} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {result.tx_hashes.map((h) => (
                <TxLink key={h} hash={h} />
              ))}
            </div>
            <table className="w-full text-left text-xs">
              <thead className="text-muted-foreground uppercase font-mono border-b border-border/40">
                <tr>
                  <th className="py-2">Batch</th>
                  <th className="py-2">Anchored at</th>
                  <th className="py-2">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {result.affected_batches.map((b) => (
                  <tr key={b.batch_id}>
                    <td className="py-2">
                      <Hex value={b.batch_id} />
                    </td>
                    <td className="py-2 text-muted-foreground">{b.anchored_at ? new Date(b.anchored_at).toLocaleString() : '—'}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded-full font-medium ${verdictStyle[b.verdict]?.cls ?? ''}`}>
                        {verdictStyle[b.verdict]?.label ?? b.verdict}
                      </span>
                    </td>
                  </tr>
                ))}
                {result.affected_batches.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-muted-foreground">
                      This key signed no batches.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground">
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
