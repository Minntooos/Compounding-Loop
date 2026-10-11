import { useState } from 'react';
import type { LoopCommit } from '@core/types';
import { ActivityChart } from './ActivityChart';
import { relativeTime } from '../lib/format';
import { dayHeading, groupByDay, laneColor, laneOfCommit, lanesIn, timeUtc } from '../lib/timeline';

/** Commits grouped by UTC day, lane-coloured (the lane name is always printed), filterable by lane. Messages render as text only. */
export function Timeline({ commits }: { commits: LoopCommit[] }) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const lanes = lanesIn(commits);
  const shown = active.size === 0 ? commits : commits.filter((c) => active.has(laneOfCommit(c.message)));
  const toggle = (lane: string) => setActive((prev) => { const next = new Set(prev); if (!next.delete(lane)) next.add(lane); return next; });
  if (commits.length === 0) return <p style={{ color: 'var(--muted)' }}>No commits yet. Start a run and they appear here.</p>;
  return (
    <div className="space-y-4">
      <ActivityChart commits={commits} />
      {lanes.length > 1 && (
        <div role="group" aria-label="Filter by lane" className="flex gap-1.5 overflow-x-auto pb-1">
          <button type="button" aria-pressed={active.size === 0} onClick={() => setActive(new Set())} className="shrink-0 rounded-full border px-3 py-1 text-[13px] min-h-11 sm:min-h-8 aria-pressed:font-semibold aria-pressed:underline" style={{ borderColor: 'var(--border)' }}>All</button>
          {lanes.map((l) => (
            <button key={l} type="button" aria-pressed={active.has(l)} onClick={() => toggle(l)} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] min-h-11 sm:min-h-8 aria-pressed:font-semibold aria-pressed:underline" style={{ borderColor: 'var(--border)' }}>
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: laneColor(l) }} />{l}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-5" data-testid="timeline">
        {groupByDay(shown).map((g) => (
          <section key={g.day} aria-label={dayHeading(g.day)}>
            <h3 className="flex items-baseline gap-2 py-1 text-[13px] font-semibold" style={{ background: 'var(--bg)' }}>
              {dayHeading(g.day)}<span className="font-normal" style={{ color: 'var(--muted)' }}>{g.commits.length} {g.commits.length === 1 ? 'commit' : 'commits'}</span>
            </h3>
            <ol className="space-y-1">
              {g.commits.map((c) => {
                const lane = laneOfCommit(c.message);
                return (
                  <li key={c.sha} data-lane={lane} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-l-[3px] py-1 pl-3" style={{ borderColor: laneColor(lane) }}>
                    <span className="min-w-0 flex-1 basis-full [overflow-wrap:anywhere] sm:basis-0">{c.message}</span>
                    <span className="font-mono text-[12px]" style={{ color: laneColor(lane) }}>{lane}</span>
                    <time dateTime={c.at} title={relativeTime(c.at)} className="font-mono text-[12px] tabular-nums" style={{ color: 'var(--muted)' }}>{timeUtc(c.at)}</time>
                    <code className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>{c.sha.slice(0, 7)}</code>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
