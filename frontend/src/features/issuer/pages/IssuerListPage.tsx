import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { GraduationCap, Key, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';
import { pendingEndpoint } from '@/api/client';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Hex } from '@/components/common/Hex';
import type { IssuersListResponse, Issuer } from '@/api/schemas';

export const IssuerListPage: React.FC = () => {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('zkred_issuer_admin_token') || '');
  const [showAuthModal, setShowAuthModal] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<IssuersListResponse>({
    queryKey: ['issuers'],
    queryFn: () => pendingEndpoint<IssuersListResponse>('V1-H1'),
    retry: false,
  });

  const saveToken = (token: string) => {
    sessionStorage.setItem('zkred_issuer_admin_token', token);
    setAdminToken(token);
    setShowAuthModal(false);
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
            Registered universities, colleges, and credential authorities on <ChainName />.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#231a3d] bg-[#130e24] text-xs font-medium text-[#f0f7f7] hover:bg-[#1a1430] transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-[#79bab6]" />
            <span>{adminToken ? 'Admin Active' : 'Enter Admin Token'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <Loading label="Loading accredited institutions..." />
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
                    ) : null}
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

      {/* Admin Token Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-[#090614]/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#130e24] border border-[#231a3d] p-6 rounded-3xl max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-semibold text-[#f0f7f7]">Issuer Admin Authentication</h3>
            <p className="text-xs text-[#8ea5a8] leading-relaxed">
              Administrative functions (issuing credentials, anchoring batches, reporting compromise) require an admin token.
              Stored in local session memory only.
            </p>
            <input
              type="password"
              placeholder="Paste ISSUER_ADMIN_TOKEN"
              defaultValue={adminToken}
              id="admin-token-input"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#231a3d] bg-[#090614] text-[#f0f7f7] placeholder-[#8ea5a8] focus:outline-hidden focus:border-[#79bab6] font-mono"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 text-xs font-medium rounded-xl text-[#8ea5a8] hover:bg-[#1a1430] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('admin-token-input') as HTMLInputElement;
                  saveToken(el?.value || '');
                }}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-[#06838d] text-white hover:bg-[#0897a3] transition-colors"
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
