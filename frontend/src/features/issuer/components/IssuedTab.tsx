// frontend/src/features/issuer/components/IssuedTab.tsx
// The registrar's records (no claims) with per-credential revocation: Revoke → confirm → the status bit is flipped
// and the list hash re-pinned on-chain (POST .../revoke). Nothing is optimistic: the row turns "Revoked" only after
// the API answers, and the toast links the transaction.
import React, { useState } from 'react';
import { toast } from 'sonner';
import { FileText, Loader2, ShieldAlert, ShieldCheck, Ban } from 'lucide-react';
import { useIssuedCredentials, useRevokeCredential } from '@/api/queries/issuers';
import { toUserMessage } from '@/api/client';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { TxLink } from '@/components/common/TxLink';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { IssuedCredential } from '@/api/schemas';

interface IssuedTabProps {
  issuerId: string;
  onPromptAuth: () => void;
}

export const IssuedTab: React.FC<IssuedTabProps> = ({ issuerId, onPromptAuth }) => {
  // Admin-only list: fetched once a token is entered (the page re-renders when it is saved).
  const { data, isLoading, error, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useIssuedCredentials(hasAdminToken() ? issuerId : undefined);
  const revoke = useRevokeCredential(issuerId);
  const [confirming, setConfirming] = useState<IssuedCredential | null>(null);

  if (!hasAdminToken()) {
    return (
      <EmptyState
        title="Admin token needed"
        description="The registrar's records are only visible to the issuer admin."
        icon={<ShieldAlert className="w-8 h-8 text-[#79bab6]" />}
        action={
          <button type="button" onClick={onPromptAuth} className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#06838d] text-white hover:bg-[#046168]">
            Enter admin token
          </button>
        }
      />
    );
  }
  if (isLoading) return <Loading label="Loading issued credentials record..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const credentials = data?.pages.flatMap((p) => p.items) ?? [];

  const confirmRevoke = (cred: IssuedCredential) =>
    revoke.mutate(cred.id, {
      onSuccess: (out) => {
        setConfirming(null);
        toast.success(`Credential revoked (status #${out.status_index})`, { description: <TxLink hash={out.tx_hash} label="status list hash on-chain" /> });
      },
      onError: (err) => toast.error(toUserMessage(err, 'Revocation failed; nothing changed.')),
    });

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-1">
        <h3 className="text-sm font-semibold text-[#f0f7f7]">Registrar Records (Zero PII at Rest)</h3>
        <p className="text-xs text-[#8ea5a8]">
          The institutional database tracks only cryptographically bound commitments, batch indices, and revocation status. Holder identities and claims are strictly client-side.
          Revoking flips one bit in a status list every verifier downloads whole, so nobody learns whose credential was revoked.
        </p>
      </div>

      {credentials.length === 0 ? (
        <EmptyState
          title="No credentials issued yet"
          description="Use the 'Issue Credential' tab to issue BBS+ signed credentials to student wallets."
          icon={<FileText className="w-8 h-8 text-[#79bab6]" />}
        />
      ) : (
        <div className="rounded-3xl border border-[#231a3d] bg-[#130e24] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-[11px] uppercase tracking-wider text-[#8ea5a8] border-b border-[#231a3d]">
                <tr>
                  <th className="p-4">Credential ID</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Recipient Wallet</th>
                  <th className="p-4">Batch ID</th>
                  <th className="p-4">Index</th>
                  <th className="p-4">Commitment</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Issued At</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#231a3d]">
                {credentials.map((cred) => (
                  <tr key={cred.id} className="hover:bg-[#1a1430]/60 transition-colors">
                    <td className="p-4 font-mono text-xs text-[#f0f7f7]">
                      <Hex value={cred.id} prefixLen={6} suffixLen={4} />
                    </td>
                    <td className="p-4">
                      <span className="inline-flex items-center text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                        {cred.credential_type}
                      </span>
                    </td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                      <Hex value={cred.wallet_id} prefixLen={6} suffixLen={4} />
                    </td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                      <Hex value={cred.batch_id} prefixLen={6} suffixLen={4} />
                    </td>
                    <td className="p-4 text-xs font-mono text-[#f0f7f7]">#{cred.status_index}</td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                      <Hex value={cred.commitment} prefixLen={6} suffixLen={4} />
                    </td>
                    <td className="p-4">
                      {cred.revoked_at ? (
                        <span
                          title={`Revoked ${new Date(cred.revoked_at).toLocaleString()}`}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff453a] bg-[#ff453a]/10 px-2.5 py-0.5 rounded-full border border-[#ff453a]/20"
                        >
                          <ShieldAlert className="w-3 h-3" /> Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                          <ShieldCheck className="w-3 h-3" /> Valid
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-[#8ea5a8] whitespace-nowrap">{new Date(cred.issued_at).toLocaleDateString()}</td>
                    <td className="p-4 text-right">
                      {!cred.revoked_at && (
                        <button
                          type="button"
                          onClick={() => setConfirming(cred)}
                          disabled={revoke.isPending}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border border-[#ff453a]/30 text-[#ff453a] bg-[#ff453a]/10 hover:bg-[#ff453a]/20 disabled:opacity-50 cursor-pointer"
                        >
                          <Ban className="w-3.5 h-3.5" /> Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasNextPage && (
            <div className="p-4 border-t border-[#231a3d] text-center">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-[#231a3d] text-[#f0f7f7] hover:bg-[#1a1430] disabled:opacity-50"
              >
                {isFetchingNextPage && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Load more
              </button>
            </div>
          )}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="revoke-title">
          <div className="bg-[#130e24] border border-[#231a3d] p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
            <h3 id="revoke-title" className="text-base font-semibold text-[#f0f7f7]">
              Revoke this {confirming.credential_type}?
            </h3>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Credential <Hex value={confirming.id} /> (status #{confirming.status_index}) will fail every future verification with “revoked”. This publishes a
              new status-list hash on-chain and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                disabled={revoke.isPending}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-[#8ea5a8] hover:bg-[#1a1430]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmRevoke(confirming)}
                disabled={revoke.isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#ff453a] text-white hover:bg-[#ff453a]/90 disabled:opacity-50"
              >
                {revoke.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {revoke.isPending ? 'Publishing on-chain…' : 'Revoke credential'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
