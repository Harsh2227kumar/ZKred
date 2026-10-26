// frontend/src/features/attack/pages/AttackConsolePage.tsx
// Red-team console (DEMO_MODE only, CONTRACTS §3.5): steal an issuer's signing key → forge + inject degrees into its
// pipeline → verify them, report the compromise on the issuer page, verify again and watch the counter flip.
import React, { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { toast } from 'sonner';
import { Copy, Flame, KeyRound, Loader2, Play, RotateCcw, ShieldAlert, ShieldCheck, Wallet } from 'lucide-react';
import { AdminTokenButton } from '@/components/common/AdminTokenButton';
import { ChainName } from '@/components/common/ChainName';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorState } from '@/components/common/ErrorState';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { TxLink } from '@/components/common/TxLink';
import { adminToken, toUserMessage } from '@/api/client';
import { useAttackState, useForge, useResetAttack, useStealKey, useVerifyForged } from '@/api/queries/attack';
import { useIssuers } from '@/api/queries/issuers';
import { useChainInfo, useCredentialSchemas } from '@/api/queries/meta';
import { AttackStepper, type AttackStep, type StepStatus } from '../components/AttackStepper';
import { AttackTimeline } from '../components/AttackTimeline';
import { ForgeryScoreboard, type VerifierMode } from '../components/ForgeryScoreboard';

/** The attack console forges degrees (CONTRACTS §3.5: POST /attack/forge signs Degree credentials). */
const FORGED_TYPE = 'Degree';
/** ForgeIn.count bounds (CONTRACTS §3.5). */
const FORGE_MIN = 1;
const FORGE_MAX = 1000;

const inputClass = 'w-full px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary';
const actionClass = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed';

export const AttackConsolePage: React.FC = () => {
  const chain = useChainInfo();
  const [hasToken, setHasToken] = useState(() => Boolean(adminToken.get()));
  const enabled = hasToken && Boolean(chain.data?.demo_mode);
  const state = useAttackState(enabled);
  const issuers = useIssuers();
  const schemas = useCredentialSchemas();
  const steal = useStealKey();
  const forge = useForge();
  const verify = useVerifyForged();
  const reset = useResetAttack();

  const [issuerId, setIssuerId] = useState('');
  const [count, setCount] = useState(25);
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [mode, setMode] = useState<VerifierMode>('full');

  // Universities first: the demo breaches a university's degree pipeline.
  const issuerList = useMemo(
    () => [...(issuers.data?.items ?? [])].sort((a, b) => Number(b.kind === 'university') - Number(a.kind === 'university')),
    [issuers.data],
  );
  const target = issuerList.find((i) => i.id === issuerId) ?? issuerList[0];
  const claimFields = schemas.data?.items.find((s) => s.type === FORGED_TYPE)?.fields.filter((f) => f.source === 'claim') ?? [];
  const stolen = state.data?.stolen_keys.find((k) => k.issuer_id === target?.id);
  const stolenKey = target?.keys.find((k) => k.key_id === stolen?.key_id);
  const forgedCount = state.data?.forged_count ?? 0;
  const runs = state.data?.runs ?? [];
  const lastFull = runs.find((r) => r.mode === 'full');
  const countValid = Number.isInteger(count) && count >= FORGE_MIN && count <= FORGE_MAX;
  const fail = (err: unknown) => toast.error(toUserMessage(err));

  if (chain.isLoading) return <Loading label="Loading chain configuration..." />;
  if (chain.error) return <ErrorState error={chain.error} onRetry={() => chain.refetch()} />;
  if (!chain.data?.demo_mode) {
    return (
      <EmptyState
        title="Attack console disabled"
        description="The backend runs with DEMO_MODE=false, so the /attack endpoints do not exist."
        icon={<ShieldCheck className="w-8 h-8 text-primary" />}
      />
    );
  }

  const stepStatus = (done: boolean, unlocked: boolean): StepStatus => (done ? 'done' : unlocked ? 'current' : 'locked');
  const steps: AttackStep[] = [
    {
      title: 'Steal the signing key',
      description: "Copies the issuer's active BBS+ secret key, as a breached issuance server would. The governance wallet stays safe.",
      status: stepStatus(Boolean(stolen), Boolean(target)),
      content: (
        <div className="space-y-2">
          {stolen && (
            <p className="text-xs text-foreground">
              Stolen <Hex value={stolen.key_id} /> at {new Date(stolen.stolen_at).toLocaleTimeString()}
            </p>
          )}
          <button
            type="button"
            disabled={!target || steal.isPending}
            onClick={() => steal.mutate(target!.id, { onSuccess: () => toast.success('Signing key stolen'), onError: fail })}
            className={`${actionClass} bg-rose-600 hover:bg-rose-600/90`}
          >
            {steal.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
            {stolen ? 'Steal again' : 'Steal key'}
          </button>
        </div>
      ),
    },
    {
      title: `Forge ${count > 0 ? count : 'N'} degrees + inject`,
      description: "Signs forged degrees with the stolen key, slips their commitments into the issuer's open batch and anchors it on-chain.",
      status: stepStatus(forgedCount > 0, Boolean(stolen)),
      content: (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            forge.mutate(
              {
                issuerId: target!.id,
                count,
                claims: Object.fromEntries(claimFields.map((f) => [f.name, f.kind === 'int' ? Number(claims[f.name]) : (claims[f.name] ?? '')])),
              },
              {
                onSuccess: (r) =>
                  toast.success(`${r.forged_count} forgeries injected`, {
                    description: r.anchor_tx_hash ? <TxLink hash={r.anchor_tx_hash} label="batch anchored" /> : 'The stolen key can no longer anchor: they stay unanchored',
                  }),
                onError: fail,
              },
            );
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {claimFields.map((f) => (
              <label key={f.name} className="space-y-0.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</span>
                <input
                  required
                  disabled={!stolen}
                  type={f.kind === 'int' ? 'number' : f.kind === 'date' ? 'date' : 'text'}
                  value={claims[f.name] ?? ''}
                  onChange={(e) => setClaims((c) => ({ ...c, [f.name]: e.target.value }))}
                  className={inputClass}
                />
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">How many</span>
              <input
                type="number"
                min={FORGE_MIN}
                max={FORGE_MAX}
                disabled={!stolen}
                value={Number.isNaN(count) ? '' : count}
                onChange={(e) => setCount(e.target.valueAsNumber)}
                className={`${inputClass} w-24`}
              />
            </label>
            <button type="submit" disabled={!stolen || !countValid || forge.isPending} className={`${actionClass} bg-rose-600 hover:bg-rose-600/90`}>
              {forge.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Copy className="w-3.5 h-3.5" />} Forge + inject
            </button>
          </div>
          {!countValid && <p className="text-[11px] text-rose-500">Between {FORGE_MIN} and {FORGE_MAX}.</p>}
          <p className="text-[11px] text-muted-foreground">Forged so far: {forgedCount}</p>
        </form>
      ),
    },
    {
      title: 'Verify the forgeries',
      description: 'Runs every forgery through the selected verifier. Then report the compromise and run it again.',
      status: stepStatus(Boolean(lastFull) && stolenKey?.status === 'compromised', forgedCount > 0),
      content: (
        <div className="space-y-3">
          <button
            type="button"
            disabled={forgedCount === 0 || verify.isPending}
            onClick={() => verify.mutate(mode, { onError: fail })}
            className={`${actionClass} ${mode === 'full' ? 'bg-emerald-600 hover:bg-emerald-600/90' : 'bg-slate-600 hover:bg-slate-600/90'}`}
          >
            {verify.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
            Verify forged ({mode === 'full' ? 'full' : 'naive'})
          </button>
          {stolenKey?.status === 'compromised' && stolenKey.compromised_from ? (
            <div className="space-y-2">
              <p className="text-xs p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                Key reported compromised from {new Date(stolenKey.compromised_from).toLocaleString()} (chain time). Verify again: forgeries
                anchored after the cutoff are isolated, legacy degrees stay valid.
              </p>
              <NavLink
                to="/wallet"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#130e24] border border-[#231a3d] hover:border-[#79bab6] text-[#79bab6] transition-colors"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Inspect Holder Wallet Recovery (Refresh)</span>
              </NavLink>
            </div>
          ) : (
            lastFull &&
            lastFull.accepted > 0 &&
            target && (
              <p className="text-xs p-2.5 rounded-lg bg-rose-500/10 text-rose-500">
                {lastFull.accepted} forgeries pass full verification: signed, anchored, in the Merkle root.{' '}
                <NavLink to={`/issuer/${target.id}?tab=keys`} className="font-semibold underline">
                  Report the compromise on the issuer page
                </NavLink>
                , then verify again.
              </p>
            )
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-rose-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Red-Team Attack Console</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Breach an issuer's pipeline, forge degrees, and watch <ChainName /> time isolate them: chain time, not claimed time.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminTokenButton onSaved={() => setHasToken(Boolean(adminToken.get()))} />
          <button
            type="button"
            disabled={!hasToken || reset.isPending}
            onClick={() => {
              if (!window.confirm('Clear the stolen keys, forgeries and runs? The chain and the issuers are not touched.')) return;
              reset.mutate(undefined, { onSuccess: () => toast.success('Attack state cleared'), onError: fail });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            {reset.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Reset
          </button>
        </div>
      </div>

      {!hasToken ? (
        <EmptyState
          title="Admin token needed"
          description="The attack endpoints need the issuer admin token. Use “Enter admin token” above."
          icon={<ShieldAlert className="w-8 h-8 text-rose-500" />}
        />
      ) : state.isLoading || issuers.isLoading || schemas.isLoading ? (
        <Loading label="Loading attack state..." />
      ) : state.error || issuers.error || schemas.error ? (
        <ErrorState
          error={state.error ?? issuers.error ?? schemas.error}
          onRetry={() => {
            void state.refetch();
            void issuers.refetch();
            void schemas.refetch();
          }}
        />
      ) : issuerList.length === 0 ? (
        <EmptyState
          title="No issuer to attack"
          description="Register an issuer and issue a few degrees first."
          action={
            <NavLink to="/issuer" className="text-xs font-semibold text-primary hover:underline">
              Open the issuer console
            </NavLink>
          }
        />
      ) : (
        <>
          <ForgeryScoreboard runs={runs} mode={mode} onModeChange={setMode} />

          <section className="space-y-4">
            <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm">
              <span className="font-medium text-foreground">Target issuer</span>
              <select
                className="px-3 py-2 rounded-lg border border-border bg-background text-sm max-w-full"
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
            <AttackStepper steps={steps} />
          </section>

          {state.data && <AttackTimeline state={state.data} issuers={issuerList} />}
        </>
      )}
    </div>
  );
};
