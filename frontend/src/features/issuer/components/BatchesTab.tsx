// frontend/src/features/issuer/components/BatchesTab.tsx
import React, { useState } from 'react';
import { Layers, Anchor, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useBatches, useAnchorBatch } from '@/api/queries/issuers';
import { TxLink } from '@/components/common/TxLink';
import { Hex } from '@/components/common/Hex';
import { ChainName } from '@/components/common/ChainName';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { toUserMessage } from '@/api/client';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { Batch } from '@/api/schemas';

interface BatchesTabProps {
  issuerId: string;
  onPromptAuth: () => void;
}

export const BatchesTab: React.FC<BatchesTabProps> = ({ issuerId, onPromptAuth }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [anchoringBatchId, setAnchoringBatchId] = useState<string | null>(null);

  const { data, isLoading, error, refetch } = useBatches(issuerId);
  const anchorMutation = useAnchorBatch(issuerId);

  const handleAnchor = async (batchId: string) => {
    setErrorMsg(null);
    if (!hasAdminToken()) {
      onPromptAuth();
      return;
    }

    setAnchoringBatchId(batchId);
    try {
      const anchored = await anchorMutation.mutateAsync(batchId);
      toast.success(
        `Batch anchored on-chain! Root: ${anchored.root ? anchored.root.slice(0, 10) + '...' : ''}`
      );
    } catch (err) {
      setErrorMsg(toUserMessage(err, 'Failed to anchor batch to AnchorRegistry.'));
    } finally {
      setAnchoringBatchId(null);
    }
  };

  if (isLoading) return <Loading label="Loading issuance batches..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const batches = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-1">
        <h3 className="text-sm font-semibold text-[#f0f7f7]">Issuance Batches & Merkle Trees</h3>
        <p className="text-xs text-[#8ea5a8]">
          Credentials are added as leaves to an open batch. Anchoring publishes the Merkle root on <ChainName />, sealing timestamped issuance evidence for zero-knowledge proofs.
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-[#ff453a]/10 border border-[#ff453a]/25 text-[#ff453a] text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Batches Table */}
      {batches.length === 0 ? (
        <EmptyState
          title="No batches created yet"
          description="Issuance batches will appear automatically when credentials are issued."
          icon={<Layers className="w-8 h-8 text-[#79bab6]" />}
        />
      ) : (
        <div className="rounded-3xl border border-[#231a3d] bg-[#130e24] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-[#8ea5a8] border-b border-[#231a3d]">
                <tr>
                  <th className="p-4">Batch ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Credentials</th>
                  <th className="p-4">Merkle Root</th>
                  <th className="p-4">Anchored At</th>
                  <th className="p-4">Action / Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#231a3d]">
                {batches.map((batch: Batch) => {
                  const isPending = anchoringBatchId === batch.batch_id;
                  const isAnchored = batch.status === 'anchored';

                  return (
                    <tr key={batch.batch_id} className="hover:bg-[#1a1430]/60 transition-colors">
                      <td className="p-4 font-mono text-xs text-[#f0f7f7]">
                        <Hex value={batch.batch_id} prefixLen={8} suffixLen={6} />
                      </td>
                      <td className="p-4">
                        {isAnchored ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                            <CheckCircle2 className="w-3 h-3" /> Anchored
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff9f0a] bg-[#ff9f0a]/10 px-2.5 py-0.5 rounded-full border border-[#ff9f0a]/20">
                            Open (Collecting)
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-xs font-mono text-[#f0f7f7]">
                        {batch.size} {batch.size === 1 ? 'leaf' : 'leaves'}
                      </td>
                      <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                        {batch.root ? <Hex value={batch.root} prefixLen={8} suffixLen={6} /> : '—'}
                      </td>
                      <td className="p-4 text-xs text-[#8ea5a8]">
                        {batch.anchored_at ? new Date(batch.anchored_at).toLocaleString() : 'Pending'}
                      </td>
                      <td className="p-4">
                        {isAnchored ? (
                          batch.tx_hash ? (
                            <TxLink hash={batch.tx_hash} />
                          ) : (
                            <span className="text-xs text-[#79bab6]">Anchored</span>
                          )
                        ) : (
                          <button
                            onClick={() => handleAnchor(batch.batch_id)}
                            disabled={isPending || batch.size === 0}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#06838d] to-[#014f85] hover:opacity-90 disabled:opacity-40 text-xs font-medium text-[#f0f7f7] transition-all cursor-pointer shadow-xs"
                          >
                            {isPending ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Anchoring...</span>
                              </>
                            ) : (
                              <>
                                <Anchor className="w-3 h-3" />
                                <span>Anchor On-Chain</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
