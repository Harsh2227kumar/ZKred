import React from 'react';
import { toast } from 'sonner';
import { Ban, Loader2 } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { adminToken, toUserMessage } from '@/api/client';
import { useIssuedCredentials, useRevokeCredential } from '@/api/queries/issuance';

export const IssuedTab: React.FC<{ issuerId: string }> = ({ issuerId }) => {
  const hasToken = Boolean(adminToken.get());
  const list = useIssuedCredentials(issuerId, hasToken);
  const revoke = useRevokeCredential(issuerId);

  if (!hasToken) return <EmptyState title="Admin token needed" description="The issued-credentials list is an admin view. Enter the admin token above." />;
  if (list.isLoading) return <Loading label="Loading issued credentials..." />;
  if (list.error) return <ErrorState error={list.error} onRetry={() => list.refetch()} />;
  const rows = list.data?.pages.flatMap((p) => p.items) ?? [];
  if (rows.length === 0) return <EmptyState title="Nothing issued yet" description="Use the Issue tab to sign a credential." />;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs font-mono uppercase text-muted-foreground border-b border-border/40">
            <tr>
              <th className="p-3">Type</th>
              <th className="p-3">Commitment</th>
              <th className="p-3">Batch</th>
              <th className="p-3">Slot</th>
              <th className="p-3">Issued</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-muted/30">
                <td className="p-3 text-xs font-medium">{c.credential_type}</td>
                <td className="p-3">
                  <Hex value={c.commitment} />
                </td>
                <td className="p-3">
                  <Hex value={c.batch_id} />
                </td>
                <td className="p-3 text-xs font-mono">{c.status_index}</td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(c.issued_at).toLocaleString()}</td>
                <td className="p-3">
                  {c.revoked_at ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 font-medium">revoked</span>
                  ) : (
                    <button
                      type="button"
                      disabled={revoke.isPending}
                      onClick={() =>
                        revoke.mutate(c.id, {
                          onSuccess: (r) => toast.success('Revoked; list hash pinned on-chain', { description: <TxLink hash={r.tx_hash} /> }),
                          onError: (err) => toast.error(toUserMessage(err)),
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 disabled:opacity-50"
                    >
                      {revoke.isPending && revoke.variables === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.hasNextPage && (
        <button
          type="button"
          onClick={() => list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
          className="w-full py-2 text-xs font-medium rounded-lg border border-border hover:bg-muted"
        >
          {list.isFetchingNextPage ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
};
