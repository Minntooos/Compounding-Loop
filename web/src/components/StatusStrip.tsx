import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AlertTriangle, Check, CheckCircle2, Circle, CircleDot, Clock, Inbox, Minus, Pause, RefreshCw, Tag, X, type LucideIcon } from 'lucide-react';
import type { LoopDetail, LoopSummary } from '@core/types';
import { api } from '../api/client';
import { attentionItems, releaseWaiting } from '../lib/lanes';
import { stripSegments, type Segment, type Tone } from '../lib/strip';

const ICON: Record<string, LucideIcon> = {
  stalled: AlertTriangle, 'release-waiting': Tag, 'likely-running': CircleDot, paused: Pause, idle: Circle, released: Tag, done: CheckCircle2,
  inbox: Inbox, check: Check, cross: X, dash: Minus, warn: AlertTriangle, tag: Tag, clock: Clock, round: RefreshCw,
};
const COLOR: Record<Tone, string> = {
  done: 'var(--done)', blocked: 'var(--blocked)', failing: 'var(--failing)', building: 'var(--building)', muted: 'var(--muted)', text: 'var(--text)',
};

type Sep = 'none' | 'desktop' | 'all';

function Item({ s, sep }: { s: Segment; sep: Sep }) {
  const Icon = ICON[s.icon] ?? Circle;
  const words = s.short === undefined ? s.text : <><span className="md:hidden">{s.short}</span><span className="max-md:hidden">{s.text}</span></>;
  const body = <><Icon aria-hidden size={14} className="shrink-0" />{words}</>;
  const cls = 'inline-flex min-w-0 items-center gap-1.5 [overflow-wrap:anywhere]';
  return (
    // An empty short text hides the whole segment on a phone.
    <li className={`flex min-w-0 items-center ${s.short === '' ? 'max-md:hidden' : ''}`} style={{ color: COLOR[s.tone] }}>
      {sep !== 'none' && <span aria-hidden className={`mr-3 ${sep === 'desktop' ? 'max-md:hidden' : ''}`} style={{ color: 'var(--muted)' }}>·</span>}
      {s.href ? <a data-segment={s.id} href={s.href} className={`${cls} underline-offset-2 hover:underline`}>{body}</a> : <span data-segment={s.id} className={cls}>{body}</span>}
    </li>
  );
}

/**
 * The status strip (DESIGN.md §12 C1): one line on desktop, two on phone (state and needs-you first). On the fleet it sums up every
 * loop; on a loop page, that loop. Its needs-you count is the shared attention list, like the banner, the nav badge and the Inbox.
 */
export function StatusStrip({ loopId }: { loopId?: string }) {
  // "Likely running" and the next-run time depend on the clock, so an open tab re-reads it every minute.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);
  const loops = useQuery({ queryKey: ['loops'], queryFn: api.loops });
  const inbox = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const all: LoopSummary[] = loops.data ?? [];
  const scoped = loopId !== undefined ? all.filter((l) => l.id === loopId) : all;
  // The loop page already loads its detail; on the fleet only a waiting release needs it (for its ship check).
  const detailId = loopId ?? all.find((l) => releaseWaiting(l))?.id;
  const detail = useQuery({ queryKey: ['loop', detailId], queryFn: () => api.loop(detailId ?? ''), enabled: detailId !== undefined });
  if (!loops.data || !inbox.data || scoped.length === 0) return null;
  const items = attentionItems(scoped, inbox.data.filter((i) => loopId === undefined || i.loopId === loopId));
  const details = new Map<string, LoopDetail>(detail.data && detailId ? [[detailId, detail.data]] : []);
  const segments = stripSegments({ loops: scoped, scoped: loopId !== undefined, attention: items.length, details, now });
  const [first, second, ...rest] = segments;
  const lineTwoStart = rest.find((s) => s.short !== '');
  return (
    <div role="status" className="border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
      <ul aria-label={loopId ? 'Loop status' : 'Fleet status'} data-testid="status-strip"
        className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[13px] md:min-h-8">
        {first && <Item s={first} sep="none" />}
        {second && <Item s={second} sep="all" />}
        {/* Phone: the rest starts its own line, so its first visible segment has no dot there. */}
        <li aria-hidden className="basis-full md:hidden" />
        {rest.map((s) => <Item key={s.id} s={s} sep={s === lineTwoStart ? 'desktop' : 'all'} />)}
      </ul>
    </div>
  );
}
