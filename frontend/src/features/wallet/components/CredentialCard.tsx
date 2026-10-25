import React, { useState } from 'react';
import { toast } from 'sonner';
import { Eye, EyeOff, GraduationCap, IdCard, Loader2, RefreshCw, Stethoscope } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { toUserMessage } from '@/api/client';
import type { StoredCredential } from '@/lib/wallet-store';
import { displayFields } from '@/lib/zk';
import type { CredentialStatus } from '../hooks/useCredentialStatus';

const typeIcon = { Degree: GraduationCap, GovernmentId: IdCard, MedicalLicense: Stethoscope } as const;

const statusBadge: Record<CredentialStatus['kind'], { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  pending_anchor: { label: 'Waiting for anchor', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  revoked: { label: 'Revoked', cls: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  needs_refresh: { label: 'Issued during compromise window', cls: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  invalid: { label: 'Invalid', cls: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
};

export const CredentialCard: React.FC<{
  stored: StoredCredential;
  status?: CredentialStatus;
  onRefresh: () => Promise<void>;
}> = ({ stored, status, onRefresh }) => {
  const [showPii, setShowPii] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cred = stored.credential;
  const Icon = typeIcon[cred.type] ?? IdCard;
  const badge = status ? statusBadge[status.kind] : null;

  const refresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Re-issue requested', { description: 'The fresh credential is in your inbox.' });
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="p-5 rounded-xl border border-border/60 bg-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-violet-500/10 text-violet-500">
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{cred.type}</h4>
            <span className="text-xs text-muted-foreground">{status?.issuer?.name ?? cred.issuer_did}</span>
          </div>
        </div>
        {badge ? (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>{badge.label}</span>
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {displayFields(cred).map((f) => (
          <div key={f.name} className="flex flex-col">
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-medium text-foreground break-words">{f.pii && !showPii ? '••••••' : f.value}</dd>
          </div>
        ))}
      </dl>

      {status?.kind === 'invalid' && <p className="text-xs text-rose-500">{status.reason}</p>}
      {status?.kind === 'needs_refresh' && (
        <p className="text-xs text-amber-500">
          The issuer reported its signing key compromised and this credential was anchored inside the compromise window. Refresh it to get
          a copy signed with the new key.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-border/40">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Key</span>
          <Hex value={cred.key_id} />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPii((s) => !s)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs border border-border hover:bg-muted"
          >
            {showPii ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
            {showPii ? 'Hide personal fields' : 'Show on this device'}
          </button>
          {status?.kind === 'needs_refresh' && (
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500 text-white hover:bg-amber-500/90 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Refresh credential
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
