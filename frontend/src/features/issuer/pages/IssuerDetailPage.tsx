import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Key, PlusCircle, FileText, Layers } from 'lucide-react';
import { apiClient } from '@/api/client';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';
import type { Issuer } from '@/api/types';

export const IssuerDetailPage: React.FC = () => {
  const { issuerId } = useParams<{ issuerId: string }>();
  const [activeTab, setActiveTab] = useState<'keys' | 'issue' | 'issued' | 'batches'>('keys');

  const { data: issuer, isLoading, error, refetch } = useQuery<Issuer>({
    queryKey: ['issuer', issuerId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/issuers/{id}', {
        params: { path: { id: issuerId! } },
      });
      if (error) throw error;
      return data;
    },
    enabled: Boolean(issuerId),
  });

  if (isLoading) return <Loading label="Loading issuer details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!issuer) return <EmptyState title="Issuer not found" description="The requested issuer ID was not found." />;

  return (
    <div className="space-y-6">
      {/* Back button + Header */}
      <div className="space-y-4 pb-6 border-b border-border/40">
        <NavLink to="/issuer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Issuers
        </NavLink>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{issuer.name}</h1>
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {issuer.kind}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>DID:</span>
              <Hex value={issuer.did} prefixLen={12} suffixLen={8} />
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/40">
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
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer ${
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider font-mono">BBS+ Signing Keys</h3>
          </div>
          <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-xs font-mono uppercase text-muted-foreground border-b border-border/40">
                <tr>
                  <th className="p-3.5">Key ID</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5">Created</th>
                  <th className="p-3.5">On-Chain Tx</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {issuer.keys?.map((k) => (
                  <tr key={k.key_id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3.5 font-mono text-xs">
                      <Hex value={k.key_id} />
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          k.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : k.status === 'compromised'
                            ? 'bg-rose-500/10 text-rose-500'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {k.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-xs text-muted-foreground">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3.5 text-xs font-mono">
                      {k.tx_hash ? <Hex value={k.tx_hash} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'issue' && (
        <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3">
          <h4 className="font-semibold text-foreground">Dynamic Credential Issuance Form</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Loads credential schemas dynamically from <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/meta/credential-schemas</code> and resolves recipient wallet via <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/wallets/lookup</code>.
          </p>
        </div>
      )}

      {activeTab === 'issued' && (
        <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3">
          <h4 className="font-semibold text-foreground">Issued Credentials History</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Lists all issued credentials with their status indices and revocation options.
          </p>
        </div>
      )}

      {activeTab === 'batches' && (
        <div className="p-8 rounded-xl border border-dashed border-border text-center space-y-3">
          <h4 className="font-semibold text-foreground">Merkle Batches & On-Chain Anchors</h4>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Shows batch Merkle roots, leaf counts, and Base Sepolia anchor transactions.
          </p>
        </div>
      )}
    </div>
  );
};
