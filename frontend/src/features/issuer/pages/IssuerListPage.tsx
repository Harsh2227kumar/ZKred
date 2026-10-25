import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLink } from 'react-router-dom';
import { Building2, Key, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';
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
    // GET /issuers (admin token) is built in V1-H1; switch to apiClient.GET('/issuers') then.
    queryFn: () => pendingEndpoint<IssuersListResponse>('V1-H1'),
    retry: false,
  });

  const saveToken = (token: string) => {
    sessionStorage.setItem('zkred_issuer_admin_token', token);
    setAdminToken(token);
    setShowAuthModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Issuer Console</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Registered certificate authorities and issuance pipelines on <ChainName />.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowAuthModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground/80 hover:bg-muted transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-primary" />
            <span>{adminToken ? 'Admin Authenticated' : 'Enter Admin Token'}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <Loading label="Loading registered issuers..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.items || data.items.length === 0 ? (
        <EmptyState
          title="No registered issuers found"
          description="Issuers will appear here once registered on-chain via the seed pipeline or API."
          icon={<Building2 className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((issuer: Issuer) => {
            const activeKey = issuer.keys?.find((k) => k.status === 'active');
            const isCompromised = issuer.keys?.some((k) => k.status === 'compromised');

            return (
              <NavLink
                key={issuer.id}
                to={`/issuer/${issuer.id}`}
                className="group p-5 rounded-xl border border-border/60 bg-card hover:border-primary/50 transition-all hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                      <Building2 className="w-5 h-5" />
                    </div>
                    {isCompromised ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                        <ShieldAlert className="w-3 h-3" /> Compromise Reported
                      </span>
                    ) : issuer.accredited ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" /> Accredited
                      </span>
                    ) : null}
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                      {issuer.name}
                    </h3>
                    <span className="text-xs font-mono text-muted-foreground uppercase">{issuer.kind}</span>
                  </div>

                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>DID:</span>
                      <Hex value={issuer.did} prefixLen={8} suffixLen={6} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active Key:</span>
                      {activeKey ? (
                        <span className="text-emerald-500 font-medium">Valid Epoch</span>
                      ) : (
                        <span className="text-amber-500 font-medium">No active key</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-primary font-medium">
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
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-foreground">Issuer Admin Token</h3>
            <p className="text-xs text-muted-foreground">
              Admin actions (issuing credentials, anchoring batches, reporting compromise) require an admin bearer token.
              Stored in sessionStorage only.
            </p>
            <input
              type="password"
              placeholder="Enter ISSUER_ADMIN_TOKEN"
              defaultValue={adminToken}
              id="admin-token-input"
              className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary font-mono"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('admin-token-input') as HTMLInputElement;
                  saveToken(el?.value || '');
                }}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Save Token
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
