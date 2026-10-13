import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Inbox as InboxIcon } from 'lucide-react';
import type { InboxItem, LoopState, LoopSummary } from '@core/types';
import { api, hasServer } from '../api/client';
import { cardBadge, cardFacts, laneProgress, statusLine, roundProgress, runBudget, SELF_BUILD_ID, selfFirst } from '../lib/card';
import { STATE_LABEL } from '../lib/format';
import { attentionItems } from '../lib/lanes';
import { needsYouRows } from '../lib/needsYou';
import { NeedsYouList } from './NeedsYouList';
import { LaneStrip } from './LaneStrip';
import { ProgressBar } from './ProgressBar';
import { StatusBadge } from './StatusBadge';
import { LoadError, Loading } from './QueryState';

function NeedsYou({ loops, inbox, demo }: { loops: LoopSummary[]; inbox: InboxItem[]; demo: boolean }) {
  const items = attentionItems(loops, inbox);
  // Nothing to do: the status strip already says "Nothing needs you", so the fleet adds no second banner.
  if (items.length === 0) return null;
  const count = items.length;
  return (
    <section aria-labelledby="needs-you-h" className="space-y-2">
      <h2 id="needs-you-h" className="text-[15px] font-semibold">
        <a href="#/inbox" className="inline-flex items-center gap-2" style={{ color: 'var(--blocked)' }}><InboxIcon aria-hidden size={18} />{count} {count === 1 ? 'thing needs' : 'things need'} you</a>
      </h2>
      <NeedsYouList rows={needsYouRows(items, loops, demo)} label="Needs you" />
    </section>
  );
}

const STATE_COLOR: Record<LoopState, string> = {
  failing: 'var(--failing)', blocked: 'var(--blocked)', building: 'var(--building)', waiting: 'var(--muted)', done: 'var(--done)',
};

function LoopCard({ loop }: { loop: LoopSummary }) {
  const lanes = laneProgress(loop);
  // Inside the final round a full round bar reads as finished, so a laned loop shows lane progress instead.
  const rounds = lanes ? undefined : roundProgress(loop);
  const runs = runBudget(loop);
  const facts = cardFacts(loop);
  const self = loop.id === SELF_BUILD_ID;
  return (
    <li className={self ? 'sm:col-span-2' : undefined}>
      <a href={`#/loop/${encodeURIComponent(loop.id)}`} data-testid="loop-card" className="block h-full rounded-lg border p-3 sm:p-4" style={{ background: 'var(--surface)', borderColor: self ? 'var(--accent)' : 'var(--border)' }}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="break-all text-[15px] font-semibold">{loop.name}</h2>
          <StatusBadge state={cardBadge(loop)} />
        </div>
        <p className="mt-1 [overflow-wrap:anywhere]" style={{ color: 'var(--muted)' }}>{statusLine(loop)}</p>
        {(rounds || lanes || runs) && <div className="mt-3 space-y-2">
          {rounds && <ProgressBar label="Rounds" {...rounds} color={STATE_COLOR[loop.state]} />}
          {lanes && <ProgressBar label="Lanes" {...lanes} color={STATE_COLOR[loop.state]} />}
          {runs && <ProgressBar label="Run budget" {...runs} color="var(--accent)" />}
        </div>}
        {facts.length > 0 && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[12px]">
            {facts.map((f) => <Fragment key={f.label}><dt style={{ color: 'var(--muted)' }}>{f.label}</dt><dd>{f.value}</dd></Fragment>)}
          </dl>
        )}
        {loop.lanes && <LaneStrip loop={{ ...loop, lanes: loop.lanes }} />}
      </a>
    </li>
  );
}

type Filter = LoopState | 'all';

function FilterBar({ loops, value, onChange }: { loops: LoopSummary[]; value: Filter; onChange: (f: Filter) => void }) {
  const present = (['failing', 'blocked', 'building', 'waiting', 'done'] as const).filter((s) => loops.some((l) => l.state === s));
  if (present.length < 2) return null;
  return (
    <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-1.5">
      {(['all', ...present] as const).map((f) => (
        <button key={f} type="button" aria-pressed={value === f} onClick={() => onChange(f)} className="rounded border px-2.5 py-1 text-[13px] aria-pressed:font-semibold aria-pressed:underline" style={{ borderColor: 'var(--border)' }}>
          {f === 'all' ? 'All' : STATE_LABEL[f]} ({f === 'all' ? loops.length : loops.filter((l) => l.state === f).length})
        </button>
      ))}
    </div>
  );
}

export function Fleet() {
  const [filter, setFilter] = useState<Filter>('all');
  const loops = useQuery({ queryKey: ['loops'], queryFn: api.loops });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  if (loops.isPending || inbox.isPending) return <Loading what="Loading the fleet…" />;
  if (loops.isError || inbox.isError) return <LoadError what="the fleet" onRetry={() => { void loops.refetch(); void inbox.refetch(); }} busy={loops.isFetching || inbox.isFetching} />;
  if (loops.data.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-[20px] font-semibold">No loops yet</h2>
        <p style={{ color: 'var(--muted)' }}>Write a brief, start a loop, and check back tomorrow.</p>
        <a href="#/new" className="inline-block rounded px-3 py-1.5 font-medium" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Create your first loop</a>
      </section>
    );
  }
  return (
    <div className="space-y-5">
      <NeedsYou loops={loops.data} inbox={inbox.data} demo={server.data === false} />
      <FilterBar loops={loops.data} value={filter} onChange={setFilter} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loops">
        {selfFirst(loops.data.filter((l) => filter === 'all' || l.state === filter)).map((l) => <LoopCard key={l.id} loop={l} />)}
      </ul>
    </div>
  );
}
