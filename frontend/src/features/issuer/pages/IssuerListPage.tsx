import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { Building2, ArrowRight, ShieldCheck, ShieldAlert, Plus, Loader2 } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';
import { AdminTokenButton } from '@/components/common/AdminTokenButton';
import { Loading } from '@/components/common/Loading';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import { useCreateIssuer, useIssuers } from '@/api/queries/issuers';
import { useEnums } from '@/api/queries/meta';
import type { Issuer } from '@/api/schemas';

const inputClass =
  'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary';

const NewIssuerDialog: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { data: enums } = useEnums();
  const create = useCreateIssuer();
  const [name, setName] = useState('');
  const [kind, setKind] = useState('');
  const [didSuffix, setDidSuffix] = useState('');
  const kinds = enums?.issuer_kinds ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), kind: (kind || kinds[0]?.value) as Issuer['kind'], did_suffix: didSuffix.trim() },
      {
        onSuccess: (issuer) => {
          toast.success(`${issuer.name} registered on-chain`, { description: issuer.did });
          onClose();
        },
        onError: (err) => toast.error(toUserMessage(err)),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-card border border-border p-6 rounded-2xl max-w-md w-full space-y-4 shadow-xl">
        <h3 className="text-lg font-bold text-foreground">Register a new issuer</h3>
        <p className="text-xs text-muted-foreground">
          Creates a BBS+ signing key and a governance wallet, then registers both on <ChainName /> (three transactions).
        </p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Name</span>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={120} required />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">Kind</span>
          <select className={inputClass} value={kind || kinds[0]?.value || ''} onChange={(e) => setKind(e.target.value)}>
            {kinds.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-foreground">DID suffix</span>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground">did:zkred:</span>
            <input
              className={`${inputClass} font-mono`}
              value={didSuffix}
              onChange={(e) => setDidSuffix(e.target.value.toLowerCase())}
              pattern="[a-z0-9\-]{3,60}"
              title="3–60 lowercase letters, digits or '-'"
              required
            />
          </div>
        </label>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} disabled={create.isPending} className="px-3.5 py-2 text-xs font-medium rounded-lg text-muted-foreground hover:bg-muted">
            Cancel
          </button>
          <button
            type="submit"
            disabled={create.isPending || kinds.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {create.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {create.isPending ? 'Registering on-chain…' : 'Register issuer'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const IssuerListPage: React.FC = () => {
  const { data, isLoading, error, refetch } = useIssuers();
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
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
          <AdminTokenButton />
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90"
          >
            <Plus className="w-3.5 h-3.5" /> New issuer
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading label="Loading registered issuers..." />
      ) : error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !data?.items.length ? (
        <EmptyState
          title="No registered issuers yet"
          description="Register one with “New issuer” (admin token needed), or run the seed script."
          icon={<Building2 className="w-8 h-8 text-primary" />}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((issuer) => {
            const activeKey = issuer.keys.find((k) => k.status === 'active');
            const isCompromised = issuer.keys.some((k) => k.status === 'compromised');
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
                    <div className="flex flex-col items-end gap-1">
                      {issuer.accredited ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          <ShieldCheck className="w-3 h-3" /> Accredited
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                          Not accredited
                        </span>
                      )}
                      {isCompromised && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                          <ShieldAlert className="w-3 h-3" /> Compromise reported
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">{issuer.name}</h3>
                    <span className="text-xs font-mono text-muted-foreground uppercase">{issuer.kind}</span>
                  </div>
                  <div className="pt-2 border-t border-border/40 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center justify-between">
                      <span>DID:</span>
                      <Hex value={issuer.did} prefixLen={14} suffixLen={6} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Active key:</span>
                      {activeKey ? <Hex value={activeKey.key_id} /> : <span className="text-amber-500 font-medium">none</span>}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-primary font-medium">
                  <span>Manage credentials & batches</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </NavLink>
            );
          })}
        </div>
      )}

      {creating && <NewIssuerDialog onClose={() => setCreating(false)} />}
    </div>
  );
};
