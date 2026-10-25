import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Send } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { toUserMessage } from '@/api/client';
import { lookupWallet, useIssueCredential } from '@/api/queries/issuance';
import { useCredentialSchemas } from '@/api/queries/meta';
import type { IssueCredentialIn, IssueCredentialOut } from '@/api/schemas';

const inputClass = 'w-full px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-hidden focus:ring-2 focus:ring-primary';

export const IssueTab: React.FC<{ issuerId: string }> = ({ issuerId }) => {
  const schemas = useCredentialSchemas();
  const issue = useIssueCredential(issuerId);
  const [type, setType] = useState('');
  const [recipient, setRecipient] = useState('');
  const [claims, setClaims] = useState<Record<string, string>>({});
  const [looking, setLooking] = useState(false);
  const [last, setLast] = useState<IssueCredentialOut | null>(null);

  if (schemas.isLoading) return <Loading label="Loading credential schemas..." />;
  if (schemas.error) return <ErrorState error={schemas.error} onRetry={() => schemas.refetch()} />;
  const items = schemas.data?.items ?? [];
  const schema = items.find((s) => s.type === type) ?? items[0];
  if (!schema) return <ErrorState error={{ error: { code: 'NOT_FOUND', message: 'No credential schemas' } }} />;
  const fields = schema.fields.filter((f) => f.source === 'claim');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLooking(true);
    try {
      const wallet = await lookupWallet(recipient.trim());
      const body: IssueCredentialIn = {
        credential_type: schema.type as IssueCredentialIn['credential_type'],
        wallet_id: wallet.id,
        claims: Object.fromEntries(fields.map((f) => [f.name, f.kind === 'int' ? Number(claims[f.name]) : (claims[f.name] ?? '')])),
      };
      const out = await issue.mutateAsync(body);
      setLast(out);
      setClaims({});
      toast.success(`${schema.type} issued to ${wallet.display_name}`, { description: 'Anchor its batch so it can be verified.' });
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setLooking(false);
    }
  };

  const busy = looking || issue.isPending;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <form onSubmit={submit} className="lg:col-span-2 p-6 rounded-xl border border-border/60 bg-card space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">Credential type</span>
            <select className={inputClass} value={schema.type} onChange={(e) => (setType(e.target.value), setClaims({}))}>
              {items.map((s) => (
                <option key={s.type} value={s.type}>
                  {s.type}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-foreground">Recipient wallet (display name)</span>
            <input className={inputClass} value={recipient} onChange={(e) => setRecipient(e.target.value)} minLength={2} required />
          </label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {fields.map((f) => (
            <label key={f.name} className="block space-y-1">
              <span className="text-xs font-medium text-foreground">
                {f.label} {f.pii && <span className="text-[10px] text-amber-500 font-semibold">PII</span>}
              </span>
              <input
                className={inputClass}
                type={f.kind === 'date' ? 'date' : f.kind === 'int' ? 'number' : 'text'}
                min={f.kind === 'int' ? 0 : undefined}
                value={claims[f.name] ?? ''}
                onChange={(e) => setClaims((c) => ({ ...c, [f.name]: e.target.value }))}
                required
              />
            </label>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          The credential is BBS+-signed, encrypted to the holder's wallet key and dropped: the server keeps only a commitment, a batch
          slot and a revocation bit, never the claims.
        </p>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Issue credential
          </button>
        </div>
      </form>

      <div className="p-5 rounded-xl border border-border/60 bg-card space-y-3 text-xs h-fit">
        <h4 className="text-sm font-semibold text-foreground">Last issued</h4>
        {last ? (
          <dl className="space-y-2">
            {(
              [
                ['Credential', last.credential_id],
                ['Batch', last.batch_id],
                ['Status list', last.status_list_id],
                ['Commitment', last.commitment],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>
                  <Hex value={v} />
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Status index</dt>
              <dd className="font-mono">{last.status_index}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-muted-foreground">Nothing issued in this session yet.</p>
        )}
      </div>
    </div>
  );
};
