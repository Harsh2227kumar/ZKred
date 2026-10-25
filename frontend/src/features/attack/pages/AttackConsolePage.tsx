import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { Flame, ShieldAlert, AlertTriangle, ShieldCheck, Loader2, KeyRound, Copy, Play, RotateCcw } from 'lucide-react';
import { ChainName } from '@/components/common/ChainName';
import { AdminTokenButton } from '@/components/common/AdminTokenButton';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Hex } from '@/components/common/Hex';
import { TxLink } from '@/components/common/TxLink';
import { adminToken, toUserMessage } from '@/api/client';
import { useAttackState, useForge, useResetAttack, useStealKey, useVerifyForged } from '@/api/queries/attack';
import { useIssuers } from '@/api/queries/issuers';
import { useChainInfo, useCredentialSchemas } from '@/api/queries/meta';
import type { AttackRunOut } from '@/api/schemas';

/** The attack console forges degrees (CONTRACTS §3.5). */
const FORGED_TYPE = 'Degree';
const MAX_FORGE = 1000;

const Counter: React.FC<{ run?: AttackRunOut; tone: 'good' | 'bad'; title: string; subtitle: string; icon: React.ReactNode }> = ({
  run,
  tone,
  title,
  subtitle,
  icon,
}) => {
  return (
    <div className={`p-6 rounded-2xl border-2 bg-card space-y-3 ${tone === 'good' ? 'border-emerald-500/40' : 'border-rose-500/30'}`}>
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-base font-bold text-foreground">{title}</h3>
      </div>
      <div className="py-2 text-center">
        <span className={`text-5xl font-black font-mono tracking-tight ${tone === 'good' ? 'text-emerald-500' : 'text-rose-500'}`}>{run ? `${run.accepted}/${run.total}` : '—'}</span>
        <span className="text-sm font-semibold text-muted-foreground block mt-1">forged credentials accepted</span>
      </div>
      {run && Object.keys(run.by_code).length > 0 && (
        <div className="flex flex-wrap justify-center gap-1.5">
          {Object.entries(run.by_code).map(([code, n]) => (
            <span key={code} className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-foreground">
              {code} × {n}
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground text-center">{subtitle}</p>
    </div>
  );
};

export const AttackConsolePage: React.FC = () => {
  const { data: chain } = useChainInfo();
  const [hasToken, setHasToken] = useState(() => Boolean(adminToken.get()));
  const state = useAttackState(hasToken && Boolean(chain?.demo_mode));
  const issuers = useIssuers();
  const schemas = useCredentialSchemas();
  const steal = useStealKey();
  const forge = useForge();
  const verify = useVerifyForged();
  const reset = useResetAttack();

  const [issuerId, setIssuerId] = useState('');
  const [count, setCount] = useState(25);
  const [claims, setClaims] = useState<Record<string, string>>({});

  const issuerList = issuers.data?.items ?? [];
  const target = issuerList.find((i) => i.id === issuerId) ?? issuerList[0];
  const claimFields = schemas.data?.items.find((s) => s.type === FORGED_TYPE)?.fields.filter((f) => f.source === 'claim') ?? [];
  const runs = state.data?.runs ?? [];
  const lastFull = runs.find((r) => r.mode === 'full');
  const lastNaive = runs.find((r) => r.mode === 'naive');
  const stolen = state.data?.stolen_keys.find((k) => k.issuer_id === target?.id);

  const fail = (err: unknown) => toast.error(toUserMessage(err));

  if (chain && !chain.demo_mode) {
    return <EmptyState title="Attack console disabled" description="The backend runs with DEMO_MODE=false, so the /attack endpoints do not exist." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Red-Team Attack Console</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Steal an issuer's signing key, forge degrees, and watch <ChainName /> chain time isolate them.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminTokenButton onSaved={() => setHasToken(Boolean(adminToken.get()))} />
          <button
            type="button"
            disabled={!hasToken || reset.isPending}
            onClick={() => reset.mutate(undefined, { onSuccess: () => toast.success('Attack state cleared'), onError: fail })}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {!hasToken ? (
        <EmptyState title="Admin token needed" description="The attack endpoints need the issuer admin token." icon={<ShieldAlert className="w-8 h-8 text-rose-500" />} />
      ) : state.error ? (
        <ErrorState error={state.error} onRetry={() => state.refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Counter
              run={lastFull}
              tone="good"
              title="ZKred full verifier"
              subtitle="Signature + accreditation + revocation + anchor time vs. the on-chain compromise cutoff."
              icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
            />
            <Counter
              run={lastNaive}
              tone="bad"
              title="Naive (signature-only) verifier"
              subtitle="Checks the BBS+ signature only. A stolen key makes every forgery look genuine."
              icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
            />
          </div>

          <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-5">
            <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
              <span className="font-medium text-foreground">Target issuer</span>
              <select
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                value={target?.id ?? ''}
                onChange={(e) => setIssuerId(e.target.value)}
              >
                {issuerList.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="text-[11px] font-mono text-muted-foreground">STEP 1</span>
                <h4 className="text-sm font-semibold text-foreground">Steal the signing key</h4>
                <p className="text-xs text-muted-foreground">Copies the active BBS+ secret key. The governance wallet stays safe.</p>
                {stolen && (
                  <p className="text-xs">
                    Stolen <Hex value={stolen.key_id} /> at {new Date(stolen.stolen_at).toLocaleTimeString()}
                  </p>
                )}
                <button
                  type="button"
                  disabled={!target || steal.isPending}
                  onClick={() => steal.mutate(target!.id, { onSuccess: () => toast.success('Signing key stolen'), onError: fail })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white disabled:opacity-50"
                >
                  {steal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />} Steal key
                </button>
              </div>

              <form
                className="p-4 rounded-xl border border-border bg-muted/20 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  forge.mutate(
                    { issuerId: target!.id, count, claims: Object.fromEntries(claimFields.map((f) => [f.name, f.kind === 'int' ? Number(claims[f.name]) : claims[f.name] ?? ''])) },
                    {
                      onSuccess: (r) =>
                        toast.success(`${r.forged_count} forgeries injected`, {
                          description: r.anchor_tx_hash ? <TxLink hash={r.anchor_tx_hash} label="batch anchored" /> : 'The stolen key can no longer anchor',
                        }),
                      onError: fail,
                    },
                  );
                }}
              >
                <span className="text-[11px] font-mono text-muted-foreground">STEP 2</span>
                <h4 className="text-sm font-semibold text-foreground">Forge degrees</h4>
                <div className="grid grid-cols-2 gap-2">
                  {claimFields.map((f) => (
                    <input
                      key={f.name}
                      required
                      type={f.kind === 'int' ? 'number' : f.kind === 'date' ? 'date' : 'text'}
                      placeholder={f.label}
                      value={claims[f.name] ?? ''}
                      onChange={(e) => setClaims((c) => ({ ...c, [f.name]: e.target.value }))}
                      className="px-2 py-1.5 text-xs rounded-md border border-border bg-background"
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={MAX_FORGE}
                    value={count}
                    onChange={(e) => setCount(Number(e.target.value))}
                    className="w-24 px-2 py-1.5 text-xs rounded-md border border-border bg-background"
                  />
                  <button
                    type="submit"
                    disabled={!stolen || forge.isPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 text-white disabled:opacity-50"
                  >
                    {forge.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Forge + inject
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">Total forged so far: {state.data?.forged_count ?? 0}</p>
              </form>

              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <span className="text-[11px] font-mono text-muted-foreground">STEP 3</span>
                <h4 className="text-sm font-semibold text-foreground">Verify, report, verify again</h4>
                <p className="text-xs text-muted-foreground">
                  Run the forgeries through both verifiers, then report the compromise on the{' '}
                  {target ? (
                    <NavLink to={`/issuer/${target.id}`} className="text-primary font-medium hover:underline">
                      issuer page
                    </NavLink>
                  ) : (
                    'issuer page'
                  )}{' '}
                  (Keys tab) and run them again.
                </p>
                <div className="flex flex-wrap gap-2">
                  {(['full', 'naive'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      disabled={verify.isPending}
                      onClick={() => verify.mutate(mode, { onError: fail })}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 ${mode === 'full' ? 'bg-emerald-600' : 'bg-slate-600'}`}
                    >
                      {verify.isPending && verify.variables === mode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Verify ({mode})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {runs.length > 0 && (
            <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-3">
              <h3 className="text-sm font-bold text-foreground">Timeline</h3>
              <ul className="space-y-1.5 text-xs">
                {runs.map((r) => (
                  <li key={r.ran_at} className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-muted-foreground">{new Date(r.ran_at).toLocaleTimeString()}</span>
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${r.mode === 'full' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-foreground'}`}>{r.mode}</span>
                    <span>
                      {r.accepted} accepted / {r.rejected} rejected of {r.total}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
};
