import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Inbox as InboxIcon } from 'lucide-react';
import type { InboxItem, LoopSummary } from '@core/types';
import { api } from '../api/client';
import { relativeTime } from '../lib/format';
import { lanesNeedingYou, needsYouCount } from '../lib/lanes';
import { LaneStrip } from './LaneStrip';
import { StatusBadge } from './StatusBadge';
import { LoadError, Loading } from './QueryState';

function NeedsYou({ loops, inbox }: { loops: LoopSummary[]; inbox: InboxItem[] }) {
  const count = needsYouCount(loops, inbox);
  // Inbox items open the inbox; otherwise the problem is a lane or a failing loop, so open that loop.
  const trouble = loops.find((l) => lanesNeedingYou(l.lanes).length > 0 || l.state === 'failing');
  const href = inbox.length === 0 && trouble ? `#/loop/${encodeURIComponent(trouble.id)}` : '#/inbox';
  if (count === 0) {
    return (
      <p role="status" className="flex items-center gap-2 rounded-lg border px-4 py-3 font-medium" style={{ borderColor: 'var(--done)', color: 'var(--done)' }}>
        <CheckCircle2 aria-hidden size={18} />Nothing needs you
      </p>
    );
  }
  return (
    <a href={href} className="flex items-center gap-2 rounded-lg border px-4 py-3 font-medium" style={{ borderColor: 'var(--blocked)', color: 'var(--blocked)' }}>
      <InboxIcon aria-hidden size={18} />{count} {count === 1 ? 'thing needs' : 'things need'} you
    </a>
  );
}

function LoopCard({ loop }: { loop: LoopSummary }) {
  return (
    <li>
      <a href={`#/loop/${encodeURIComponent(loop.id)}`} data-testid="loop-card" className="block h-full rounded-lg border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="break-all text-[15px] font-semibold">{loop.name}</h3>
          <StatusBadge state={loop.state} />
        </div>
        <p className="mt-1" style={{ color: 'var(--muted)' }}>{loop.reason}</p>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[12px]">
          <dt style={{ color: 'var(--muted)' }}>Round</dt><dd>{loop.round}/{loop.roundsTotal}</dd>
          <dt style={{ color: 'var(--muted)' }}>Run</dt><dd>{loop.run}/{loop.runLimit}</dd>
          <dt style={{ color: 'var(--muted)' }}>Next run</dt><dd>{loop.nextRunAt ? relativeTime(loop.nextRunAt) : 'none'}</dd>
          <dt style={{ color: 'var(--muted)' }}>Tests</dt><dd>{loop.tests ? `${loop.tests.passed} passed${loop.tests.failed ? `, ${loop.tests.failed} failed` : ''}` : 'no result'}</dd>
          <dt style={{ color: 'var(--muted)' }}>Live</dt><dd>{loop.live ? (loop.live.ok ? `up (${loop.live.status})` : `down (${loop.live.status})`) : 'not checked'}</dd>
        </dl>
        {loop.lanes && <LaneStrip lanes={loop.lanes} />}
      </a>
    </li>
  );
}

export function Fleet() {
  const loops = useQuery({ queryKey: ['loops'], queryFn: api.loops });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
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
      <NeedsYou loops={loops.data} inbox={inbox.data} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loops">
        {loops.data.map((l) => <LoopCard key={l.id} loop={l} />)}
      </ul>
    </div>
  );
}
