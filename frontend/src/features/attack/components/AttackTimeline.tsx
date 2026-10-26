// frontend/src/features/attack/components/AttackTimeline.tsx
// What happened, newest first, from GET /attack/state (stolen keys, verifier runs) and the issuers' on-chain key
// records (the compromise cutoff, in chain time).
import React from 'react';
import { KeyRound, Play, ShieldAlert } from 'lucide-react';
import { Hex } from '@/components/common/Hex';
import type { AttackState, Issuer } from '@/api/schemas';

interface TimelineEvent {
  at: string;
  icon: React.ReactNode;
  tone: 'bad' | 'good' | 'neutral';
  text: React.ReactNode;
}

const toneClass: Record<TimelineEvent['tone'], string> = {
  bad: 'bg-rose-500/10 text-rose-500',
  good: 'bg-emerald-500/10 text-emerald-500',
  neutral: 'bg-muted text-muted-foreground',
};

function eventsOf(state: AttackState, issuers: Issuer[]): TimelineEvent[] {
  const issuerName = (id: string) => issuers.find((i) => i.id === id)?.name ?? 'an issuer';
  const events: TimelineEvent[] = [];
  for (const s of state.stolen_keys) {
    events.push({
      at: s.stolen_at,
      icon: <KeyRound className="w-3.5 h-3.5" />,
      tone: 'bad',
      text: (
        <>
          Signing key <Hex value={s.key_id} /> of {issuerName(s.issuer_id)} stolen
        </>
      ),
    });
    const key = issuers.find((i) => i.id === s.issuer_id)?.keys.find((k) => k.key_id === s.key_id);
    if (key?.status === 'compromised' && key.compromised_from) {
      events.push({
        at: key.compromised_from,
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
        tone: 'good',
        text: <>Compromise cutoff (chain time): anything this key anchored from here on is isolated</>,
      });
    }
  }
  for (const r of state.runs) {
    events.push({
      at: r.ran_at,
      icon: <Play className="w-3.5 h-3.5" />,
      tone: r.accepted > 0 ? 'bad' : 'good',
      text: (
        <>
          <span className="font-semibold">{r.mode === 'full' ? 'Full' : 'Naive'} verifier</span>: {r.accepted} of {r.total} forgeries accepted
        </>
      ),
    });
  }
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

export const AttackTimeline: React.FC<{ state: AttackState; issuers: Issuer[] }> = ({ state, issuers }) => {
  const events = eventsOf(state, issuers);
  return (
    <section className="p-5 sm:p-6 rounded-3xl border border-border bg-card space-y-3">
      <h3 className="text-sm font-bold text-foreground">Timeline</h3>
      {events.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nothing yet. Start with step 1.</p>
      ) : (
        <ol className="space-y-2">
          {events.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex items-start gap-3 text-xs">
              <span className={`mt-0.5 p-1 rounded-md shrink-0 ${toneClass[e.tone]}`}>{e.icon}</span>
              <time dateTime={e.at} title={new Date(e.at).toLocaleString()} className="font-mono text-muted-foreground shrink-0 w-20">
                {new Date(e.at).toLocaleTimeString()}
              </time>
              <span className="text-foreground min-w-0 break-words">{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};
