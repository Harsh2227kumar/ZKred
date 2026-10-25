import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Key, PlusCircle, FileText, Layers, ShieldCheck } from 'lucide-react';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';
import { AdminTokenButton } from '@/components/common/AdminTokenButton';
import { useIssuer } from '@/api/queries/issuers';
import { KeysTab } from '../components/KeysTab';
import { IssueTab } from '../components/IssueTab';
import { IssuedTab } from '../components/IssuedTab';
import { BatchesTab } from '../components/BatchesTab';

const TABS = [
  { id: 'keys', label: 'Keys & epochs', icon: Key },
  { id: 'issue', label: 'Issue credential', icon: PlusCircle },
  { id: 'issued', label: 'Issued credentials', icon: FileText },
  { id: 'batches', label: 'Batches & anchors', icon: Layers },
] as const;
type TabId = (typeof TABS)[number]['id'];

export const IssuerDetailPage: React.FC = () => {
  const { issuerId } = useParams<{ issuerId: string }>();
  const [activeTab, setActiveTab] = useState<TabId>('keys');
  const qc = useQueryClient();
  const { data: issuer, isLoading, error, refetch } = useIssuer(issuerId);

  if (isLoading) return <Loading label="Loading issuer details..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!issuer) return <EmptyState title="Issuer not found" description="The requested issuer ID was not found." />;

  return (
    <div className="space-y-6">
      <div className="space-y-4 pb-6 border-b border-border/40">
        <NavLink to="/issuer" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to issuers
        </NavLink>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{issuer.name}</h1>
              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">{issuer.kind}</span>
              {issuer.accredited && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3 h-3" /> Accredited on-chain
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span>DID:</span>
              <Hex value={issuer.did} prefixLen={20} suffixLen={8} />
              <span>Governance:</span>
              <Hex value={issuer.governance_address} />
            </div>
          </div>
          <AdminTokenButton onSaved={() => qc.invalidateQueries({ queryKey: ['issued', issuer.id] })} />
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-border/40 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-all cursor-pointer ${
                isActive ? 'border-primary text-primary font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'keys' && <KeysTab issuer={issuer} />}
      {activeTab === 'issue' && <IssueTab issuerId={issuer.id} />}
      {activeTab === 'issued' && <IssuedTab issuerId={issuer.id} />}
      {activeTab === 'batches' && <BatchesTab issuerId={issuer.id} />}
    </div>
  );
};
