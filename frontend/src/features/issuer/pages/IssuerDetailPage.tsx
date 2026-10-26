// frontend/src/features/issuer/pages/IssuerDetailPage.tsx
import React, { useState } from 'react';
import { useParams, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  Key,
  PlusCircle,
  FileText,
  Layers,
  GraduationCap,
  ShieldCheck,
} from 'lucide-react';
import { useIssuer } from '@/api/queries/issuers';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';
import { Hex } from '@/components/common/Hex';
import { KeysTab } from '../components/KeysTab';
import { IssueForm } from '../components/IssueForm';
import { IssuedTab } from '../components/IssuedTab';
import { BatchesTab } from '../components/BatchesTab';
import { AdminTokenPrompt } from '../components/AdminTokenPrompt';
import { hasAdminToken } from '@/lib/storage/session-token';

export const IssuerDetailPage: React.FC = () => {
  const { issuerId } = useParams<{ issuerId: string }>();
  const [activeTab, setActiveTab] = useState<'keys' | 'issue' | 'issued' | 'batches'>('keys');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAdminToken());

  const { data: issuer, isLoading, error, refetch } = useIssuer(issuerId);

  const handleAuthSaved = () => {
    setIsAuthenticated(hasAdminToken());
  };

  if (isLoading) return <Loading label="Loading institution details from Base Sepolia..." />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;
  if (!issuer) return <EmptyState title="Institution not found" description="The requested institution record was not found." />;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Back button + Header */}
      <div className="space-y-4 pb-6 border-b border-[#231a3d]">
        <div className="flex items-center justify-between">
          <NavLink
            to="/issuer"
            className="inline-flex items-center gap-1.5 text-xs text-[#8ea5a8] hover:text-[#f0f7f7] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Institutions
          </NavLink>

          <button
            onClick={() => setShowAuthModal(true)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
              isAuthenticated
                ? 'border-[#06838d]/40 bg-[#06838d]/15 text-[#79bab6]'
                : 'border-[#231a3d] bg-[#130e24] text-[#8ea5a8] hover:bg-[#1a1430] hover:text-[#f0f7f7]'
            }`}
          >
            <Key className="w-3 h-3" />
            <span>{isAuthenticated ? 'Admin Active' : 'Enter Admin Token'}</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">{issuer.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[11px] uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#130e24] text-[#79bab6] border border-[#06838d]/30 font-medium">
                    {issuer.kind}
                  </span>
                  {issuer.accredited ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                      <ShieldCheck className="w-3 h-3" /> Accredited on-chain
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff9f0a] bg-[#ff9f0a]/10 px-2.5 py-0.5 rounded-full border border-[#ff9f0a]/20">
                      Pending Accreditation
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#8ea5a8]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#8ea5a8]/70">DID:</span>
                <Hex value={issuer.did} prefixLen={10} suffixLen={6} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#8ea5a8]/70">Governance Address:</span>
                <Hex value={issuer.governance_address} prefixLen={6} suffixLen={4} />
              </div>
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
        <KeysTab
          issuer={issuer}
          onPromptAuth={() => setShowAuthModal(true)}
        />
      )}

      {activeTab === 'issue' && (
        <IssueForm
          issuerId={issuer.id}
          onPromptAuth={() => setShowAuthModal(true)}
          onIssuedSuccess={() => setActiveTab('batches')}
        />
      )}

      {activeTab === 'issued' && (
        <IssuedTab
          issuerId={issuer.id}
          onPromptAuth={() => setShowAuthModal(true)}
        />
      )}

      {activeTab === 'batches' && (
        <BatchesTab
          issuerId={issuer.id}
          onPromptAuth={() => setShowAuthModal(true)}
        />
      )}

      {/* Admin Token Modal */}
      <AdminTokenPrompt
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSaved={handleAuthSaved}
      />
    </div>
  );
};
