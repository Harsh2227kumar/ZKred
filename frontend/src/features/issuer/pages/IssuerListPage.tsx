// frontend/src/features/issuer/pages/IssuerListPage.tsx
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  GraduationCap,
  Key,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';
import { useIssuers } from '@/api/queries/issuers';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Hex } from '@/components/common/Hex';
import { AdminTokenPrompt } from '../components/AdminTokenPrompt';
import { CreateIssuerDialog } from '../components/CreateIssuerDialog';
import { hasAdminToken } from '@/lib/storage/session-token';
import type { Issuer } from '@/api/schemas';

export const IssuerListPage: React.FC = () => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasAdminToken());

  const { data, isLoading, error, refetch } = useIssuers();

  const handleAuthSaved = () => {
    setIsAuthenticated(hasAdminToken());
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#231a3d]">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
              <GraduationCap className="w-4.5 h-4.5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#f0f7f7]">Institution Issuance</h1>
          </div>
          <p className="text-sm text-[#8ea5a8] mt-1">
            Registered universities, medical councils, and credential authorities on <ChainName />.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAuthModal(true)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-medium transition-colors cursor-pointer ${
              isAuthenticated
                ? 'border-[#06838d]/40 bg-[#06838d]/15 text-[#79bab6]'
                : 'border-[#231a3d] bg-[#130e24] text-[#8ea5a8] hover:bg-[#1a1430] hover:text-[#f0f7f7]'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isAuthenticated ? 'Admin Active' : 'Enter Admin Token'}</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gradient-to-r from-[#06838d] to-[#014f85] text-xs font-medium text-[#f0f7f7] hover:opacity-90 transition-opacity cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Institution</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <Loading label="Loading accredited institutions from Base Sepolia..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.items || data.items.length === 0 ? (
        <EmptyState
          title="No registered institutions found"
          description="Institutions will appear here once registered on-chain via the seed pipeline or API."
          icon={<GraduationCap className="w-8 h-8 text-[#79bab6]" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.items.map((issuer: Issuer) => {
            const activeKey = issuer.keys?.find((k) => k.status === 'active');
            const isCompromised = issuer.keys?.some((k) => k.status === 'compromised');

            return (
              <NavLink
                key={issuer.id}
                to={`/issuer/${issuer.id}`}
                className="group p-6 rounded-3xl border border-[#231a3d] bg-[#130e24] hover:border-[#06838d]/40 hover:bg-[#1a1430] transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="w-10 h-10 rounded-2xl bg-[#06838d]/15 text-[#79bab6] flex items-center justify-center">
                      <GraduationCap className="w-5 h-5" />
                    </div>
                    {isCompromised ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#ff453a] bg-[#ff453a]/10 px-2.5 py-0.5 rounded-full border border-[#ff453a]/20">
                        <ShieldAlert className="w-3 h-3" /> Compromised
                      </span>
                    ) : issuer.accredited ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#79bab6] bg-[#06838d]/15 px-2.5 py-0.5 rounded-full border border-[#06838d]/30">
                        <ShieldCheck className="w-3 h-3" /> Accredited
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#8ea5a8] bg-[#1a1430] px-2.5 py-0.5 rounded-full border border-[#231a3d]">
                        Pending
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="font-semibold text-[#f0f7f7] text-base group-hover:text-[#79bab6] transition-colors">
                      {issuer.name}
                    </h3>
                    <span className="text-xs text-[#8ea5a8] uppercase tracking-wider">{issuer.kind}</span>
                  </div>

                  <div className="pt-3 border-t border-[#231a3d] text-xs text-[#8ea5a8] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span>DID:</span>
                      <Hex value={issuer.did} prefixLen={8} suffixLen={6} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Key:</span>
                      {activeKey ? (
                        <span className="text-[#79bab6] font-medium">Valid Epoch</span>
                      ) : (
                        <span className="text-[#ff9f0a] font-medium">No active key</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-[#231a3d] flex items-center justify-between text-xs text-[#79bab6] font-medium">
                  <span>Manage Credentials & Batches</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </NavLink>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <AdminTokenPrompt
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSaved={handleAuthSaved}
      />

      <CreateIssuerDialog
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onPromptAuth={() => setShowAuthModal(true)}
      />
    </div>
  );
};
