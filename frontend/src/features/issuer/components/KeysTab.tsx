import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import { toUserMessage } from '@/api/client';
import { useRotateKey } from '@/api/queries/issuers';
import type { Issuer } from '@/api/schemas';
import { CompromiseDialog } from './CompromiseDialog';

const statusClass: Record<string, string> = {
  active: 'bg-emerald-500/10 text-emerald-500',
  compromised: 'bg-rose-500/10 text-rose-500',
  rotated: 'bg-muted text-muted-foreground',
};

export const KeysTab: React.FC<{ issuer: Issuer }> = ({ issuer }) => {
  const rotate = useRotateKey(issuer.id);
  const [compromiseKey, setCompromiseKey] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">BBS+ signing keys</h3>
        <button
          type="button"
          disabled={rotate.isPending}
          onClick={() =>
            rotate.mutate(undefined, {
              onSuccess: (k) => toast.success('Key rotated on-chain', { description: k.key_id }),
              onError: (err) => toast.error(toUserMessage(err)),
            })
          }
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
        >
          {rotate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Rotate active key
        </button>
      </div>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-mono uppercase text-muted-foreground border-b border-border/40">
            <tr>
              <th className="p-3.5">Key ID</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5">Active from (chain)</th>
              <th className="p-3.5">Compromised from</th>
              <th className="p-3.5">Tx</th>
              <th className="p-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {issuer.keys.map((k) => (
              <tr key={k.key_id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3.5">
                  <Hex value={k.key_id} />
                </td>
                <td className="p-3.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusClass[k.status] ?? ''}`}>{k.status}</span>
                </td>
                <td className="p-3.5 text-xs text-muted-foreground">{new Date(k.active_from).toLocaleString()}</td>
                <td className="p-3.5 text-xs text-rose-500">{k.compromised_from ? new Date(k.compromised_from).toLocaleString() : '—'}</td>
                <td className="p-3.5">
                  <TxLink hash={k.tx_hash} />
                </td>
                <td className="p-3.5 text-right">
                  <button
                    type="button"
                    onClick={() => setCompromiseKey(k.key_id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-rose-500 border border-rose-500/30 hover:bg-rose-500/10"
                  >
                    <ShieldAlert className="w-3.5 h-3.5" /> Report compromise
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {compromiseKey && <CompromiseDialog issuerId={issuer.id} keyId={compromiseKey} onClose={() => setCompromiseKey(null)} />}
    </div>
  );
};
