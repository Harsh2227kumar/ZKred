import React from 'react';
import { toast } from 'sonner';
import { Anchor, Loader2 } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { ChainName } from '@/components/common/ChainName';
import { toUserMessage } from '@/api/client';
import { useAnchorBatch, useBatches } from '@/api/queries/issuance';

export const BatchesTab: React.FC<{ issuerId: string }> = ({ issuerId }) => {
  const batches = useBatches(issuerId);
  const anchor = useAnchorBatch(issuerId);

  if (batches.isLoading) return <Loading label="Loading batches..." />;
  if (batches.error) return <ErrorState error={batches.error} onRetry={() => batches.refetch()} />;
  const rows = batches.data?.items ?? [];
  if (rows.length === 0) return <EmptyState title="No batches yet" description="Issuing a credential opens a batch." />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A batch's Merkle root is anchored on <ChainName />; the block time becomes the trusted issuance time of every credential in it.
        Credentials verify only once their batch is anchored.
      </p>
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-mono uppercase text-muted-foreground border-b border-border/40">
            <tr>
              <th className="p-3">Batch</th>
              <th className="p-3">Key</th>
              <th className="p-3">Size</th>
              <th className="p-3">Root</th>
              <th className="p-3">Anchored at (chain)</th>
              <th className="p-3">Tx / action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((b) => (
              <tr key={b.batch_id} className="hover:bg-muted/30">
                <td className="p-3">
                  <Hex value={b.batch_id} />
                </td>
                <td className="p-3">
                  <Hex value={b.key_id} />
                </td>
                <td className="p-3 text-xs font-mono">{b.size}</td>
                <td className="p-3">{b.root ? <Hex value={b.root} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                <td className="p-3 text-xs text-muted-foreground">{b.anchored_at ? new Date(b.anchored_at).toLocaleString() : '—'}</td>
                <td className="p-3">
                  {b.status === 'anchored' ? (
                    b.tx_hash ? <TxLink hash={b.tx_hash} /> : <span className="text-xs text-emerald-500">anchored</span>
                  ) : (
                    <button
                      type="button"
                      disabled={anchor.isPending}
                      onClick={() =>
                        anchor.mutate(b.batch_id, {
                          onSuccess: (r) => toast.success('Batch anchored on-chain', { description: r.tx_hash ? <TxLink hash={r.tx_hash} /> : undefined }),
                          onError: (err) => toast.error(toUserMessage(err)),
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {anchor.isPending && anchor.variables === b.batch_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Anchor className="w-3 h-3" />}
                      Anchor
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
