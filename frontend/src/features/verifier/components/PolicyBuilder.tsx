import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useCredentialSchemas, useEnums } from '@/api/queries/meta';
import type { PresentationPolicy } from '@/api/schemas';

type Requirement = PresentationPolicy['requirements'][number];
type CredentialType = Requirement['credential_type'];
type IssuerKind = NonNullable<Requirement['issuer_kinds']>[number];

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-emerald-500';

/** A new requirement for `type` with the safe defaults: accredited issuer, not revoked, nothing revealed. */
export function blankRequirement(id: string, type: CredentialType): Requirement {
  return { id, credential_type: type, accredited_only: true, issuer_kinds: null, issuer_dids: null, reveal: [], equals: [], predicates: [], require_not_revoked: true };
}

/** "r<n+1>" where n is the largest numeric suffix in use, so ids stay unique after removals. */
const nextId = (p: PresentationPolicy) => `r${Math.max(0, ...p.requirements.map((r) => Number(r.id.replace(/\D/g, '')) || 0)) + 1}`;

/** Manual policy editor; also shows (and lets the verifier edit) a policy Claude produced. */
export const PolicyBuilder: React.FC<{ policy: PresentationPolicy; onChange: (p: PresentationPolicy) => void }> = ({ policy, onChange }) => {
  const { data: schemas } = useCredentialSchemas();
  const { data: enums } = useEnums();
  const types = schemas?.items ?? [];

  const setReq = (i: number, r: Requirement) => onChange({ ...policy, requirements: policy.requirements.map((x, j) => (j === i ? r : x)) });
  const fieldsOf = (type: string) => types.find((s) => s.type === type)?.fields.filter((f) => f.source !== 'meta') ?? [];

  /** never_collect = every PII field of the requested types that is not revealed (keeps the schema refinements happy). */
  const withNeverCollect = (p: PresentationPolicy): PresentationPolicy => {
    const revealed = new Set(p.requirements.flatMap((r) => r.reveal));
    const pii = new Set(p.requirements.flatMap((r) => fieldsOf(r.credential_type).filter((f) => f.pii).map((f) => f.name)));
    return { ...p, never_collect: [...pii].filter((f) => !revealed.has(f)) };
  };
  const update = (p: PresentationPolicy) => onChange(withNeverCollect(p));

  return (
    <div className="space-y-4">
      <label className="block space-y-1">
        <span className="text-xs font-medium text-foreground">Purpose</span>
        <input className={inputClass} value={policy.purpose} onChange={(e) => onChange({ ...policy, purpose: e.target.value })} maxLength={500} />
      </label>

      {policy.requirements.map((r, i) => {
        const fields = fieldsOf(r.credential_type);
        const age = r.predicates.find((p) => p.type === 'age_gte')?.years;
        return (
          <div key={r.id} className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <select
                className={`${inputClass} max-w-xs`}
                value={r.credential_type}
                onChange={(e) => update({ ...policy, requirements: policy.requirements.map((x, j) => (j === i ? blankRequirement(r.id, e.target.value as CredentialType) : x)) })}
              >
                {types.map((t) => (
                  <option key={t.type} value={t.type}>
                    {t.type}
                  </option>
                ))}
              </select>
              {policy.requirements.length > 1 && (
                <button
                  type="button"
                  onClick={() => update({ ...policy, requirements: policy.requirements.filter((_, j) => j !== i) })}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-rose-500"
                  aria-label="Remove requirement"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <div>
              <span className="text-xs font-medium text-foreground">Reveal</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {fields
                  .filter((f) => !(f.source === 'derived' && f.pii))
                  .map((f) => {
                    const on = r.reveal.includes(f.name);
                    return (
                      <button
                        key={f.name}
                        type="button"
                        onClick={() =>
                          update({
                            ...policy,
                            requirements: policy.requirements.map((x, j) =>
                              j === i
                                ? { ...x, reveal: on ? x.reveal.filter((n) => n !== f.name) : [...x.reveal, f.name], equals: on ? x.equals.filter((q) => q.field !== f.name) : x.equals }
                                : x,
                            ),
                          })
                        }
                        className={`px-2 py-1 rounded-md text-xs border ${on ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600' : 'border-border text-muted-foreground'}`}
                      >
                        {f.label}
                        {f.pii && <span className="ml-1 text-[10px] text-amber-500">PII</span>}
                      </button>
                    );
                  })}
              </div>
            </div>

            {r.reveal.length > 0 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-foreground">Must equal (optional)</span>
                {r.reveal.map((name) => {
                  const eq = r.equals.find((q) => q.field === name);
                  return (
                    <div key={name} className="flex items-center gap-2">
                      <span className="text-xs w-40 text-muted-foreground">{fields.find((f) => f.name === name)?.label ?? name}</span>
                      <input
                        className={inputClass}
                        placeholder="any value"
                        value={eq?.value ?? ''}
                        onChange={(e) => {
                          const others = r.equals.filter((q) => q.field !== name);
                          setReq(i, { ...r, equals: e.target.value ? [...others, { field: name, value: e.target.value }] : others });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {fields.some((f) => f.name === 'dob_commitment') && (
                <label className="flex items-center gap-2">
                  <span className="text-foreground">Minimum age (ZK proof)</span>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    className="w-20 px-2 py-1 rounded-md border border-border bg-background"
                    value={age ?? ''}
                    onChange={(e) => setReq(i, { ...r, predicates: e.target.value ? [{ type: 'age_gte', years: Number(e.target.value) }] : [] })}
                  />
                </label>
              )}
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.accredited_only} onChange={(e) => setReq(i, { ...r, accredited_only: e.target.checked })} />
                <span className="text-foreground">Accredited issuer only</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={r.require_not_revoked} onChange={(e) => setReq(i, { ...r, require_not_revoked: e.target.checked })} />
                <span className="text-foreground">Must not be revoked</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-foreground">Issuer kind</span>
                <select
                  className="px-2 py-1 rounded-md border border-border bg-background"
                  value={r.issuer_kinds?.[0] ?? ''}
                  onChange={(e) => setReq(i, { ...r, issuer_kinds: e.target.value ? [e.target.value as IssuerKind] : null })}
                >
                  <option value="">any</option>
                  {(enums?.issuer_kinds ?? []).map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        disabled={types.length === 0}
        onClick={() => update({ ...policy, requirements: [...policy.requirements, blankRequirement(nextId(policy), types[0]!.type as CredentialType)] })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
      >
        <Plus className="w-3.5 h-3.5" /> Add requirement
      </button>
      {policy.never_collect.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Never collected: {policy.never_collect.join(', ')}</p>
      )}
    </div>
  );
};
