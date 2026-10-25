// frontend/src/features/issuer/components/IssuedTab.tsx
import React from 'react';
import { FileText, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useIssuedCredentials } from '@/api/queries/issuers';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import type { IssuedCredential } from '@/api/schemas';

interface IssuedTabProps {
  issuerId: string;
  onPromptAuth: () => void;
}

export const IssuedTab: React.FC<IssuedTabProps> = ({ issuerId }) => {
  const { data, isLoading, error, refetch } = useIssuedCredentials(issuerId);

  if (isLoading) return <Loading label="Loading issued credentials record..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const credentials = data?.items || [];

  return (
    <div className="space-y-6">
      {/* Privacy Notice Banner */}
      <div className="p-5 rounded-3xl border border-[#231a3d] bg-[#130e24] space-y-1">
        <h3 className="text-sm font-semibold text-[#f0f7f7]">Registrar Records (Zero PII at Rest)</h3>
        <p className="text-xs text-[#8ea5a8]">
          The institutional database tracks only cryptographically bound commitments, batch indices, and revocation status. Holder identities and claims are strictly client-side.
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
                </tr>
              </thead>
              <tbody className="divide-y divide-[#231a3d]">
                {credentials.map((cred: IssuedCredential) => (
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
                    <td className="p-4 text-xs font-mono text-[#f0f7f7]">
                      #{cred.status_index}
                    </td>
                    <td className="p-4 font-mono text-xs text-[#8ea5a8]">
                      <Hex value={cred.commitment} prefixLen={6} suffixLen={4} />
                    </td>
                    <td className="p-4">
                      {cred.revoked_at ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff453a] bg-[#ff453a]/10 px-2.5 py-0.5 rounded-full border border-[#ff453a]/20">
                          <ShieldAlert className="w-3 h-3" /> Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                          <ShieldCheck className="w-3 h-3" /> Valid
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-xs text-[#8ea5a8]">
                      {new Date(cred.issued_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
