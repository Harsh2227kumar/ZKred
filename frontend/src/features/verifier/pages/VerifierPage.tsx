import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, Sparkles, Send, Loader2, HelpCircle, Plus } from 'lucide-react';
import { toUserMessage } from '@/api/client';
import { useCredentialSchemas } from '@/api/queries/meta';
import { useCreateRequest, useCreateVerifier, useParsePolicy, useVerifiers } from '@/api/queries/verifiers';
import type { PresentationPolicy } from '@/api/schemas';
import { PolicyBuilder, blankRequirement } from '../components/PolicyBuilder';

const VERIFIER_KEY = 'zkred_verifier_id';
const readVerifier = () => {
  try {
    return localStorage.getItem(VERIFIER_KEY) ?? '';
  } catch {
    return '';
  }
};
const rememberVerifier = (id: string) => {
  try {
    localStorage.setItem(VERIFIER_KEY, id);
  } catch {
    // per-viewer convenience only
  }
};

const questionsOf = (err: unknown): string[] => {
  const q = (err as { error?: { code?: string; details?: { questions?: unknown } } })?.error;
  return q?.code === 'POLICY_AMBIGUOUS' && Array.isArray(q.details?.questions) ? (q.details.questions as string[]) : [];
};

export const VerifierPage: React.FC = () => {
  const navigate = useNavigate();
  const verifiers = useVerifiers();
  const schemas = useCredentialSchemas();
  const createVerifier = useCreateVerifier();
  const parse = useParsePolicy();
  const createRequest = useCreateRequest();

  const [verifierId, setVerifierId] = useState(readVerifier);
  const [newVerifier, setNewVerifier] = useState('');
  const [text, setText] = useState('');
  const [policy, setPolicy] = useState<PresentationPolicy | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [fromAi, setFromAi] = useState(false);

  const verifierList = verifiers.data?.items ?? [];
  const selected = verifierList.find((v) => v.id === verifierId) ?? null;
  const firstType = schemas.data?.items[0]?.type;

  const choose = (id: string) => {
    setVerifierId(id);
    rememberVerifier(id);
  };

  const runParse = () =>
    parse.mutate(text.trim(), {
      onSuccess: (out) => {
        setPolicy(out.policy);
        setNotes(out.minimisation_notes);
        setFromAi(true);
      },
      onError: (err) => {
        if (!questionsOf(err).length) toast.error(toUserMessage(err));
      },
    });

  const startManual = () => {
    if (!firstType) return;
    setPolicy({ purpose: text.trim() || 'Verification', requirements: [blankRequirement('r1', firstType as never)], never_collect: [] });
    setNotes([]);
    setFromAi(false);
  };

  const submit = () => {
    if (!selected || !policy) return;
    createRequest.mutate(
      { verifierId: selected.id, policy, nlText: fromAi ? text.trim() : null },
      {
        onSuccess: (req) => navigate(`/verifier/requests/${req.id}`),
        onError: (err) => toast.error(toUserMessage(err)),
      },
    );
  };

  const questions = parse.isError ? questionsOf(parse.error) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Verifier Portal</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Describe what you need in plain English, or build the proof policy yourself.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span>AI policy generator (Claude on AWS Bedrock)</span>
            </div>
            <textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              className="w-full p-3.5 rounded-xl border border-border bg-background text-sm text-foreground focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
              placeholder="e.g. Hiring a junior doctor: an active medical license from an accredited council and age 21 or older. No date of birth or address."
            />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={startManual} className="px-4 py-2 rounded-xl text-sm font-medium border border-border hover:bg-muted">
                Build manually
              </button>
              <button
                type="button"
                onClick={runParse}
                disabled={parse.isPending || text.trim().length < 10}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-violet-600 text-white hover:bg-violet-600/90 disabled:opacity-50"
              >
                {parse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Generate policy
              </button>
            </div>
            {questions.length > 0 && (
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-amber-600">
                  <HelpCircle className="w-4 h-4" /> Claude needs a bit more detail
                </div>
                <ul className="text-xs text-foreground list-disc pl-4 space-y-1">
                  {questions.map((q) => (
                    <li key={q}>{q}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-muted-foreground">Edit your text and generate again, or build the policy manually.</p>
              </div>
            )}
          </div>

          {policy && (
            <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">{fromAi ? 'Generated policy (editable)' : 'Policy'}</h3>
              {notes.length > 0 && (
                <ul className="text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 list-disc pl-6 space-y-1">
                  {notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <PolicyBuilder policy={policy} onChange={setPolicy} />
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={!selected || createRequest.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-600/90 disabled:opacity-50"
                >
                  {createRequest.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {selected ? 'Create request link' : 'Pick a verifier first'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-border/60 bg-card space-y-4 shadow-sm h-fit">
          <h3 className="text-sm font-bold text-foreground">Requesting as</h3>
          {verifiers.isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <div className="space-y-1.5">
              {verifierList.map((v) => (
                <label key={v.id} className={`flex items-center gap-2 p-2 rounded-lg border text-sm cursor-pointer ${v.id === verifierId ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border/60'}`}>
                  <input type="radio" name="verifier" checked={v.id === verifierId} onChange={() => choose(v.id)} />
                  <span className="text-foreground">{v.name}</span>
                </label>
              ))}
              {verifierList.length === 0 && <p className="text-xs text-muted-foreground">No verifiers yet: create one.</p>}
            </div>
          )}
          <form
            className="flex items-center gap-2 pt-2 border-t border-border/40"
            onSubmit={(e) => {
              e.preventDefault();
              createVerifier.mutate(newVerifier.trim(), {
                onSuccess: (v) => {
                  choose(v.id);
                  setNewVerifier('');
                },
                onError: (err) => toast.error(toUserMessage(err)),
              });
            }}
          >
            <input
              value={newVerifier}
              onChange={(e) => setNewVerifier(e.target.value)}
              placeholder="New verifier name"
              minLength={2}
              maxLength={120}
              required
              className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-border bg-background"
            />
            <button type="submit" disabled={createVerifier.isPending} className="p-2 rounded-lg bg-emerald-600 text-white disabled:opacity-50" aria-label="Create verifier">
              <Plus className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
