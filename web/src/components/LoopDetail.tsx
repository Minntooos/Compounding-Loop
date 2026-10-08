import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import type { LoopDetail as Detail } from '@core/types';
import { api } from '../api/client';
import { relativeTime } from '../lib/format';
import { StatusBadge } from './StatusBadge';
import { LoadError, Loading } from './QueryState';

const TABS = ['Timeline', 'Contract', 'Knowledge', 'Decisions', 'Settings'] as const;
type Tab = (typeof TABS)[number];

// Entries are plain text from repo files: rendered as text nodes only, never as HTML.
function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p style={{ color: 'var(--muted)' }}>{empty}</p>;
  return <ul className="space-y-2">{items.map((t, i) => <li key={i} className="whitespace-pre-wrap rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>{t}</li>)}</ul>;
}

function TabBody({ tab, loop }: { tab: Tab; loop: Detail }) {
  switch (tab) {
    case 'Timeline':
      return (
        <ol className="space-y-2">
          {loop.timeline.map((c) => (
            <li key={c.sha} className="flex gap-3"><code className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>{c.sha.slice(0, 7)}</code><span className="flex-1">{c.message}</span><span style={{ color: 'var(--muted)' }}>{relativeTime(c.at)}</span></li>
          ))}
        </ol>
      );
    case 'Contract':
      return (
        <ul className="space-y-2">
          {loop.contract.map((c, i) => (
            <li key={i} className="flex items-start gap-2" style={{ color: c.pass ? 'var(--done)' : 'var(--failing)' }}>
              {c.pass ? <Check aria-label="Passes" size={16} /> : <X aria-label="Fails" size={16} />}<span style={{ color: 'var(--text)' }}>{c.text}</span>
            </li>
          ))}
        </ul>
      );
    case 'Knowledge': return <TextList items={loop.knowledge} empty="No knowledge entries yet." />;
    case 'Decisions': return <TextList items={loop.decisions} empty="No decisions recorded." />;
    case 'Settings':
      return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 font-mono text-[13px]">
          <dt style={{ color: 'var(--muted)' }}>Run limit</dt><dd>{loop.runLimit}</dd>
          <dt style={{ color: 'var(--muted)' }}>Rounds</dt><dd>{loop.roundsTotal}</dd>
          <dt style={{ color: 'var(--muted)' }}>Site</dt><dd className="break-all">{loop.url ?? 'none'}</dd>
        </dl>
      );
  }
}

function onTabKey(e: React.KeyboardEvent, tab: Tab, setTab: (t: Tab) => void) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const next = TABS[(TABS.indexOf(tab) + step + TABS.length) % TABS.length] ?? tab;
  setTab(next);
  document.getElementById(`tab-${next}`)?.focus();
}

export function LoopDetail({ id }: { id: string }) {
  const [tab, setTab] = useState<Tab>('Timeline');
  const q = useQuery({ queryKey: ['loop', id], queryFn: () => api.loop(id) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="this loop" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  if (!q.data) return <p role="alert">No loop called “{id}”. <a href="#/" className="underline">Back to the fleet</a></p>;
  const loop = q.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <StatusBadge state={loop.state} /><span style={{ color: 'var(--muted)' }}>{loop.reason}</span>
        <span className="font-mono text-[12px]">Round {loop.round}/{loop.roundsTotal} · Run {loop.run}/{loop.runLimit}</span>
      </div>
      <div role="tablist" aria-label="Loop sections" className="flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button key={t} type="button" role="tab" tabIndex={tab === t ? 0 : -1} onKeyDown={(e) => onTabKey(e, tab, setTab)} id={`tab-${t}`} aria-controls="loop-panel" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-t px-3 py-2 aria-selected:border-b-2 aria-selected:font-semibold" style={{ borderColor: 'var(--accent)' }}>{t}</button>
        ))}
      </div>
      <div role="tabpanel" id="loop-panel" aria-labelledby={`tab-${tab}`}><TabBody tab={tab} loop={loop} /></div>
    </div>
  );
}
