import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Key, PlusCircle, FileText, Layers, GraduationCap } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';
import { pendingEndpoint } from '@/api/client';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import type { Issuer } from '@/api/schemas';

export const IssuerDetailPage: React.FC = () => {
  const { issuerId } = useParams<{ issuerId: string }>();
  const [activeTab, setActiveTab] = useState<'keys' | 'issue' | 'issued' | 'batches'>('keys');

  const { data: issuer, isLoading, error, refetch } = useQuery<Issuer>({
    queryKey: ['issuer', issuerId],
    queryFn: () => pendingEndpoint<Issuer>('V1-H1'),
    enabled: Boolean(issuerId),
    retry: false,
  });

  if (isLoading) return <Loading label="Loading institution details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!issuer) return <EmptyState title="Institution not found" description="The requested institution record was not found." />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button + Header */}
      <div className="space-y-4 pb-6 border-b border-[#231a3d]">
        <NavLink to="/issuer" className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Institutions
        </NavLink>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">{issuer.name}</h1>
              <span className="text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#130e24] text-[#79bab6] border border-[#06838d]/30 font-medium">
                {issuer.kind}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-[#8ea5a8]">
              <span>DID:</span>
              <Hex value={issuer.did} prefixLen={12} suffixLen={8} />
            </div>
          </div>
        </div>
      </div>

      {/* Segmented Control Tabs */}
      <div className="inline-flex items-center p-1 rounded-2xl bg-[#130e24] border border-[#231a3d]">
        {[
          { id: 'keys', label: 'Keys & Epochs', icon: Key },
          { id: 'issue', label: 'Issue Credential', icon: PlusCircle },
          { id: 'issued', label: 'Issued Credentials', icon: FileText },
          { id: 'batches', label: 'Batches & Anchors', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#231a3d] text-[#f0f7f7] shadow-xs'
                  : 'text-[#8ea5a8] hover:text-[#f0f7f7]'
              }`}
            >
              <Icon className="w-3.5 h-3.5 opacity-80" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#8ea5a8] uppercase tracking-wider">Signing Key Epochs</h3>
          </div>
          <div className="rounded-3xl border border-[#231a3d] bg-[#130e24] overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-black/40 text-xs uppercase tracking-wider text-[#8ea5a8] border-b border-[#231a3d]">
                <tr>
                  <th className="p-4">Key ID</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Active From</th>
                  <th className="p-4">On-Chain Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#231a3d]">
                {issuer.keys?.map((k) => (
                  <tr key={k.key_id} className="hover:bg-[#1a1430] transition-colors">
                    <td className="p-4 font-mono text-xs">
                      <Hex value={k.key_id} />
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          k.status === 'active'
                            ? 'bg-[#06838d]/15 text-[#79bab6] border border-[#06838d]/30'
                            : k.status === 'compromised'
                            ? 'bg-[#ff453a]/10 text-[#ff453a] border border-[#ff453a]/20'
                            : 'bg-[#231a3d] text-[#8ea5a8]'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="p-4 text-xs text-[#8ea5a8]">
                      {new Date(k.active_from).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-xs font-mono">
                      {k.tx_hash ? <TxLink hash={k.tx_hash} /> : <span className="text-[#8ea5a8]">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'issue' && (
        <div className="p-8 rounded-3xl border border-dashed border-[#231a3d] bg-[#130e24] text-center space-y-3">
          <h4 className="font-semibold text-[#f0f7f7]">Dynamic Credential Issuance</h4>
          <p className="text-xs text-[#8ea5a8] max-w-md mx-auto leading-relaxed">
            Loads credential schemas dynamically from <code className="text-xs bg-[#090614] px-2 py-0.5 rounded border border-[#231a3d] text-[#f0f7f7]">/meta/credential-schemas</code> and resolves student wallet via lookup.
          </p>
        </div>
      )}

      {activeTab === 'issued' && (
        <div className="p-8 rounded-3xl border border-dashed border-[#231a3d] bg-[#130e24] text-center space-y-3">
          <h4 className="font-semibold text-[#f0f7f7]">Issued Academic Credentials</h4>
          <p className="text-xs text-[#8ea5a8] max-w-md mx-auto leading-relaxed">
            Historical list of issued diplomas, student cards, and certificates with real-time status indices.
          </p>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="p-8 rounded-3xl border border-dashed border-[#231a3d] bg-[#130e24] text-center space-y-3">
          <h4 className="font-semibold text-[#f0f7f7]">Merkle Batches & On-Chain Anchors</h4>
          <p className="text-xs text-[#8ea5a8] max-w-md mx-auto leading-relaxed">
            Shows batch Merkle roots, leaf counts, and <ChainName /> anchor transactions.
          </p>
        </div>
      )}
    </div>
  );
};
