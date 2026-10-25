import React, { useMemo, useState } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Shield, Eye, Lock, ShieldCheck, CheckCircle2, XCircle, Loader2, Send, Clock } from 'lucide-react';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Loading } from '@/components/common/Loading';
import { toUserMessage } from '@/api/client';
import { useIssuers } from '@/api/queries/issuers';
import { fetchBatchLeaves } from '@/api/queries/issuance';
import { submitPresentation, useRequest } from '@/api/queries/verifiers';
import type { Verification } from '@/api/schemas';
import { createPresentation, fieldLabel, matchCredentials, todayDays, type IssuerInfo, type PresentationRequirement } from '@/lib/zk';
import { useWalletSession } from '../hooks/useWalletSession';

type Phase = 'idle' | 'fetching' | 'proving' | 'submitting' | 'done';
const PHASES: { id: Exclude<Phase, 'idle' | 'done'>; label: string }[] = [
  { id: 'fetching', label: 'Fetching issuer keys and batch anchors' },
  { id: 'proving', label: 'Signing proofs (BBS+), Merkle path, age proof' },
  { id: 'submitting', label: 'Submitting to the verifier' },
];

function requirementLines(r: PresentationRequirement) {
  const t = r.credential_type;
  return {
    revealed: r.reveal.map((f) => fieldLabel(t, f)),
    proven: [
      ...r.predicates.map((p) => `Age ≥ ${p.years} (date of birth stays hidden)`),
      ...r.equals.map((e) => `${fieldLabel(t, e.field)} = “${e.value}”`),
      r.accredited_only ? 'Issued by an accredited issuer' : null,
      r.require_not_revoked ? 'Not revoked' : null,
    ].filter((x): x is string => Boolean(x)),
  };
}

export const WalletRespondPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('request');
  const req = useRequest(requestId);
  const issuers = useIssuers();
  const session = useWalletSession();
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<Verification | null>(null);

  const issuerInfo = useMemo<Record<string, IssuerInfo>>(
    () => Object.fromEntries((issuers.data?.items ?? []).map((i) => [i.did, { kind: i.kind, accredited: i.accredited }])),
    [issuers.data],
  );
  const creds = useMemo(() => session.wallet?.credentials.map((c) => c.credential) ?? [], [session.wallet]);
  const matches = useMemo(
    () =>
      Object.fromEntries(
        (req.data?.policy.requirements ?? []).map((r) => [r.id, matchCredentials(r, creds, { todayDays: todayDays(), issuers: issuerInfo })]),
      ),
    [req.data, creds, issuerInfo],
  );

  if (!requestId) {
    return (
      <EmptyState
        title="Missing presentation request"
        description="Open a request link from a verifier."
        action={
          <NavLink to="/wallet" className="text-xs text-primary font-semibold hover:underline">
            Go to my wallet
          </NavLink>
        }
      />
    );
  }
  if (req.isLoading || session.loading || issuers.isLoading) return <Loading label="Loading the request..." />;
  if (req.error) return <ErrorState error={req.error} onRetry={() => req.refetch()} />;
  if (issuers.error) return <ErrorState error={issuers.error} onRetry={() => issuers.refetch()} />;
  const request = req.data!;
  const policy = request.policy;
  const allMatched = policy.requirements.every((r) => (matches[r.id]?.length ?? 0) > 0);

  const share = async () => {
    setResult(null);
    try {
      setPhase('fetching');
      const used = policy.requirements.flatMap((r) => matches[r.id] ?? []);
      const batchIds = [...new Set(used.map((c) => c.values.batch_id).filter(Boolean))] as string[];
      const batchLeaves: Record<string, string[]> = {};
      for (const b of await Promise.all(batchIds.map(fetchBatchLeaves))) batchLeaves[b.batch_id] = b.leaves;

      setPhase('proving');
      const presentation = await createPresentation({
        request: { id: request.id, nonce: request.nonce, policy },
        credentials: used,
        issuerKeys: (issuers.data?.items ?? []).flatMap((i) => i.keys),
        batchLeaves,
        issuers: issuerInfo,
      });

      setPhase('submitting');
      const v = await submitPresentation(request.id, presentation);
      setResult(v);
      setPhase('done');
      if (v.result === 'accepted') toast.success('Verified by the verifier');
      else toast.error('The verifier rejected the presentation');
    } catch (err) {
      setPhase('idle');
      toast.error(toUserMessage(err));
    }
  };

  const busy = phase !== 'idle' && phase !== 'done';
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <NavLink to="/wallet" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to wallet
      </NavLink>

      <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{request.verifier_name} asks for proof</h1>
          </div>
          <p className="text-sm text-foreground">{policy.purpose}</p>
          <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <Clock className="w-3 h-3" /> Expires {new Date(request.expires_at).toLocaleString()}
          </p>
        </div>

        <p className="text-sm text-muted-foreground whitespace-pre-line p-4 rounded-xl bg-muted/40">{request.consent_summary}</p>

        {policy.requirements.map((r) => {
          const lines = requirementLines(r);
          const found = matches[r.id] ?? [];
          return (
            <div key={r.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">{r.credential_type}</h3>
                {found.length ? (
                  <span className="text-[11px] font-semibold text-emerald-500">You have {found.length} matching</span>
                ) : (
                  <span className="text-[11px] font-semibold text-rose-500">No matching credential in this wallet</span>
                )}
              </div>
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase tracking-wider">
                  <Eye className="w-4 h-4" /> Revealed
                </div>
                <p className="text-xs text-foreground">{lines.revealed.length ? lines.revealed.join(', ') : 'No personal fields'}</p>
                <p className="text-[11px] text-muted-foreground">Always included: credential type, issuer, signing key, batch and revocation slot.</p>
              </div>
              <div className="p-4 rounded-xl border border-mint/20 bg-mint/5 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-bold text-mint uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" /> Checked / proven (nothing more revealed)
                </div>
                <ul className="text-xs text-foreground list-disc pl-4">
                  {lines.proven.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}

        {policy.never_collect.length > 0 && (
          <div className="p-4 rounded-xl border border-border/60 bg-muted/40 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
              <Lock className="w-4 h-4" /> Never shared
            </div>
            <p className="text-xs text-foreground">{policy.never_collect.map((f) => f.replace(/_/g, ' ')).join(', ')}</p>
          </div>
        )}

        {!session.wallet ? (
          <EmptyState
            title="No wallet in this browser"
            description="Create or restore your wallet first."
            action={
              <NavLink to="/wallet" className="text-xs text-primary font-semibold hover:underline">
                Open wallet
              </NavLink>
            }
          />
        ) : (
          <>
            {busy && (
              <ol className="space-y-1.5 text-xs">
                {PHASES.map((p, i) => {
                  const current = PHASES.findIndex((x) => x.id === phase);
                  return (
                    <li key={p.id} className={`flex items-center gap-2 ${i <= current ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {i < current ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : i === current ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="w-3.5" />}
                      {p.label}
                    </li>
                  );
                })}
              </ol>
            )}
            <button
              type="button"
              onClick={share}
              disabled={!allMatched || busy || result?.result === 'accepted'}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {result?.result === 'accepted' ? 'Shared' : 'Share proofs'}
            </button>
          </>
        )}

        {result && (
          <div
            className={`p-4 rounded-xl border space-y-2 ${result.result === 'accepted' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-rose-500/30 bg-rose-500/5'}`}
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              {result.result === 'accepted' ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <XCircle className="w-5 h-5 text-rose-500" />}
              {result.result === 'accepted' ? 'Accepted by the verifier' : 'Rejected'}
            </div>
            {result.steps
              .filter((s) => !s.ok)
              .map((s) => (
                <p key={`${s.requirement_id}-${s.step}`} className="text-xs text-rose-500">
                  {s.code}: {s.message}
                </p>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
