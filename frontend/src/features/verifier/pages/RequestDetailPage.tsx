import React from 'react';
import { useParams, NavLink } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Clock, ShieldCheck, Lock, CheckCircle2, XCircle, MinusCircle, BadgeCheck, ExternalLink } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { useEnums } from '@/api/queries/meta';
import { useRequest, useVerifications } from '@/api/queries/verifiers';
import type { PresentationPolicy, Verification } from '@/api/schemas';

/** Friendly text for each verification step code (CONTRACTS §3.6). */
const CODE_TEXT: Record<string, string> = {
  OK: 'Passed',
  BBS_INVALID: 'Signature proof invalid',
  ISSUER_UNKNOWN: 'Unknown issuer',
  ISSUER_NOT_ACCREDITED: 'Issuer not accredited',
  ISSUER_NOT_ALLOWED: 'Issuer not accepted by this policy',
  KEY_UNKNOWN: 'Unknown signing key',
  PUBKEY_HASH_MISMATCH: 'Key does not match the chain',
  POLICY_FIELD_MISSING: 'Requested field missing',
  POLICY_EQUALS_FAILED: 'Value does not match',
  AGE_PROOF_INVALID: 'Age proof invalid',
  AGE_COMMITMENT_MISMATCH: 'Age proof about another credential',
  AGE_PROOF_STALE_DATE: 'Age proof not valid for today',
  REVOKED: 'Revoked by the issuer',
  REVOCATION_LIST_TAMPERED: 'Revocation list tampered',
  BATCH_NOT_ANCHORED: 'Not anchored on-chain',
  MERKLE_PROOF_INVALID: 'Not in the anchored batch',
  KEY_COMPROMISED_ANCHORED_IN_WINDOW: 'Issued during key compromise',
  CHAIN_UNAVAILABLE: 'Chain unreachable (fail closed)',
};

const EvalChain: React.FC<{ policy: PresentationPolicy; verification: Verification; stepOrder: { value: string; label: string }[] }> = ({
  policy,
  verification,
  stepOrder,
}) => (
  <div className="space-y-6">
    {policy.requirements.map((r) => {
      const steps = verification.steps.filter((s) => s.requirement_id === r.id);
      // dob_commitment is only the anchor of the age proof (a big field element), not something a person reads.
      const revealed = Object.fromEntries(Object.entries(verification.revealed[r.id] ?? {}).filter(([k]) => k !== 'dob_commitment'));
      return (
        <div key={r.id} className="space-y-3">
          <h4 className="text-sm font-semibold text-foreground">
            {r.credential_type} <span className="text-xs font-mono text-muted-foreground">({r.id})</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {stepOrder.map((node, i) => {
              const s = steps.find((x) => x.step === node.value);
              const state = !s ? 'skipped' : s.ok ? 'ok' : 'failed';
              const cls =
                state === 'ok'
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : state === 'failed'
                    ? 'border-rose-500/50 bg-rose-500/5'
                    : 'border-border/60 bg-muted/20 opacity-60';
              return (
                <div key={node.value} className={`p-4 rounded-xl border space-y-2 ${cls}`}>
                  <span className="text-[11px] font-mono text-muted-foreground block">STAGE {i + 1}</span>
                  <h5 className="text-sm font-semibold text-foreground">{node.label}</h5>
                  <div className="flex items-center gap-1.5 text-xs">
                    {state === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                    {state === 'failed' && <XCircle className="w-3.5 h-3.5 text-rose-500" />}
                    {state === 'skipped' && <MinusCircle className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className={state === 'failed' ? 'text-rose-500 font-semibold' : 'text-foreground'}>
                      {s ? (CODE_TEXT[s.code] ?? s.code) : 'Not reached'}
                    </span>
                  </div>
                  {s && <p className="text-[11px] text-muted-foreground leading-snug">{s.message}</p>}
                </div>
              );
            })}
          </div>
          {Object.keys(revealed).length > 0 && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-muted/30">
              {Object.entries(revealed).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{k.replace(/_/g, ' ')}</dt>
                  <dd className="font-medium text-foreground truncate" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      );
    })}
  </div>
);

export const RequestDetailPage: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const { data: enums } = useEnums();
  const req = useRequest(requestId);
  const verifications = useVerifications(requestId, true);
  const latest = verifications.data?.items[0];
  const accepted = verifications.data?.items.find((v) => v.result === 'accepted');
  const shown = accepted ?? latest;
  const stepOrder = enums?.verification_steps ?? [];

  if (req.isLoading) return <Loading label="Loading request..." />;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <NavLink to="/verifier" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to verifier portal
      </NavLink>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{req.data?.policy.purpose ?? 'Verification'}</h1>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>Request:</span>
            <Hex value={requestId ?? ''} />
            {req.data && <span>· {req.data.verifier_name}</span>}
          </div>
        </div>
        {accepted ? (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 text-sm font-bold">
            <BadgeCheck className="w-5 h-5" /> Verified Portable Credential
          </div>
        ) : latest ? (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-semibold">
            <XCircle className="w-3.5 h-3.5" /> Rejected, waiting for another answer
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-xs font-semibold">
            <Clock className="w-3.5 h-3.5 animate-spin" /> Awaiting holder
          </div>
        )}
      </div>

      {req.error ? (
        <ErrorState error={req.error} />
      ) : (
        req.data &&
        !accepted && (
          <div className="p-5 rounded-2xl border border-border/60 bg-card flex flex-col sm:flex-row items-center gap-6">
            <div className="p-3 bg-white rounded-xl">
              <QRCodeSVG value={req.data.wallet_url} size={140} />
            </div>
            <div className="space-y-2 text-sm min-w-0">
              <p className="font-semibold text-foreground">Ask the holder to open this link in their wallet</p>
              <p className="text-xs text-muted-foreground">{req.data.consent_summary}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Hex value={req.data.wallet_url} prefixLen={32} suffixLen={8} />
                <a href={req.data.wallet_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                  Open wallet <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-[11px] text-muted-foreground">Expires {new Date(req.data.expires_at).toLocaleString()}</p>
            </div>
          </div>
        )
      )}

      <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-6 shadow-sm">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
          <h3 className="text-base font-bold text-foreground">Evaluation chain</h3>
        </div>
        {verifications.error ? (
          <ErrorState error={verifications.error} />
        ) : shown && req.data ? (
          <EvalChain policy={req.data.policy} verification={shown} stepOrder={stepOrder} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {stepOrder.map((s, i) => (
              <div key={s.value} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
                <span className="text-[11px] font-mono text-muted-foreground block">STAGE {i + 1}</span>
                <h5 className="text-sm font-semibold text-foreground">{s.label}</h5>
                <span className="text-xs text-muted-foreground">Pending proof</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {req.data && req.data.policy.never_collect.length > 0 && (
        <div className="p-5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-start gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-foreground">Never received</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This verifier never receives: <strong>{req.data.policy.never_collect.map((f) => f.replace(/_/g, ' ')).join(', ')}</strong>. Checks pass
              through BBS+ selective disclosure and zero-knowledge proofs instead.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
