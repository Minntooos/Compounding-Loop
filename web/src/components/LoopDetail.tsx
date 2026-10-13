import { useQuery } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { LoopDetail as Detail } from '@core/types';
import { api } from '../api/client';
import { Timeline } from './Timeline';
import { LanesTab } from './LanesTab';
import { RunsTab } from './RunsTab';
import { TestsTab } from './TestsTab';
import { ReleasesTab } from './ReleasesTab';
import { LaneNotesView } from './LaneNotesView';
import { relativeTime } from '../lib/format';
import { ShipPanel } from './ShipPanel';
import { ControlBar } from './ControlBar';
import { StatusBadge } from './StatusBadge';
import { LoadError, Loading } from './QueryState';
import { ProgressBar } from './ProgressBar';
import { cardBadge, headerReason, headerRound, releasedText, statusLine } from '../lib/card';
import { useScrollFade } from './useScrollFade';
import { runLimitText, siteOf } from '../lib/settings';
import { scheduleClock } from '../lib/schedule';
import { slugOf } from '../lib/controls';
import type { RunFocus } from '../lib/route';
import { HeatMap } from './HeatMap';

const BASE_TABS = ['Timeline', 'Contract', 'Knowledge', 'Decisions', 'Settings'] as const;
type Tab = (typeof BASE_TABS)[number] | 'Lanes' | 'Runs' | 'Tests' | 'Releases';
/** Lanes (after Timeline) and Runs (after Lanes) appear only for loops that send them. */
const tabsFor = (loop: Detail): Tab[] => ['Timeline', ...(loop.lanes ? ['Lanes' as const] : []), ...(loop.runs ? ['Runs' as const, 'Tests' as const] : []), ...BASE_TABS.slice(1), ...(loop.releases ? ['Releases' as const] : [])];

// Entries are plain text from repo files: rendered as text nodes only, never as HTML.
function TextList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) return <p style={{ color: 'var(--muted)' }}>{empty}</p>;
  return <ul className="space-y-2">{items.map((t, i) => <li key={i} className="whitespace-pre-wrap rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>{t}</li>)}</ul>;
}

const heatFor = (loop: Detail) => ({ loopId: loop.id, now: scheduleClock(loop, new Date()), ...(loop.lanes && { lanes: loop.lanes.map((l) => l.name) }) });

function TabBody({ tab, loop, focus, toRuns }: { tab: Tab; loop: Detail; focus?: RunFocus; toRuns: () => void }) {
  switch (tab) {
    case 'Timeline':
      if (!loop.runs?.length) return <Timeline commits={loop.timeline} />;
      return <div className="space-y-6"><HeatMap runs={loop.runs} {...heatFor(loop)} onPick={toRuns} /><Timeline commits={loop.timeline} /></div>;
    case 'Lanes': return <LanesTab lanes={loop.lanes ?? []} cockpit={{ ...(loop.schedule && { schedule: loop.schedule }), ...(loop.idleRuns && { idleRuns: loop.idleRuns }), ...(loop.steer && { steer: loop.steer }), ...(loop.paused && { loopPaused: true }), ...(loop.pace && { pace: loop.pace }), loopId: loop.id, ...(slugOf(loop.repoUrl ?? loop.url) && { slug: slugOf(loop.repoUrl ?? loop.url) as string }), now: scheduleClock(loop, new Date()) }} />;
    case 'Runs': return <RunsTab runs={loop.runs ?? []} paused={loop.paused !== undefined} quiet={(loop.lanes ?? []).filter((l) => l.state === 'done' || l.state === 'blocked').map((l) => l.name)} {...(loop.nextRuns && { nextRuns: loop.nextRuns })} heat={heatFor(loop)} {...(focus && { focus })} />;
    case 'Tests': return <TestsTab runs={loop.runs ?? []} />;
    case 'Releases': return <ReleasesTab releases={loop.releases ?? []} />;
    case 'Contract':
      if (loop.laneNotes?.length) return <LaneNotesView notes={loop.laneNotes} kind="contract" />;
      if (loop.contract.length === 0) return <p style={{ color: 'var(--muted)' }}>No contract lines yet. They appear when the task file has a Done-when list.</p>;
      return (
        <ul className="space-y-2">
          {loop.contract.map((c, i) => (
            <li key={i} className="flex items-start gap-2" style={{ color: c.pass ? 'var(--done)' : 'var(--failing)' }}>
              {c.pass ? <Check aria-label="Passes" size={16} /> : <X aria-label="Fails" size={16} />}<span style={{ color: 'var(--text)' }}>{c.text}</span>
            </li>
          ))}
        </ul>
      );
    case 'Knowledge':
      if (loop.laneNotes?.length) return <LaneNotesView notes={loop.laneNotes} kind="knowledge" />;
      return <TextList items={loop.knowledge} empty="No knowledge entries yet." />;
    case 'Decisions':
      if (loop.laneNotes?.length) return <LaneNotesView notes={loop.laneNotes} kind="decisions" />;
      return <TextList items={loop.decisions} empty="No decisions recorded." />;
    case 'Settings':
      return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 font-mono text-[13px]">
          <dt style={{ color: 'var(--muted)' }}>Run limit</dt><dd>{runLimitText(loop)}</dd>
          <dt style={{ color: 'var(--muted)' }}>Rounds</dt><dd>{loop.roundsTotal}</dd>
          <dt style={{ color: 'var(--muted)' }}>Site</dt><dd className="break-all">{siteOf(loop) ?? 'none'}</dd>
        </dl>
      );
  }
}

function onTabKey(e: React.KeyboardEvent, tabs: Tab[], tab: Tab, setTab: (t: Tab) => void) {
  const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const next = tabs[(tabs.indexOf(tab) + step + tabs.length) % tabs.length] ?? tab;
  setTab(next);
  document.getElementById(`tab-${next}`)?.focus();
}

export function LoopDetail({ id, focus }: { id: string; focus?: RunFocus }) {
  const [tab, setTab] = useState<Tab>(focus ? 'Runs' : 'Timeline');
  // A cell's click switches tabs itself (the same link twice fires no hashchange); this covers links opened from elsewhere.
  // A heat-map cell link changes only the query, so the page stays mounted: switch to Runs on every new pick.
  const focusKey = focus && `${focus.lane}@${focus.at}`;
  useEffect(() => { if (focusKey) setTab('Runs'); }, [focusKey]);
  const q = useQuery({ queryKey: ['loop', id], queryFn: () => api.loop(id) });
  // Re-measure when the tab row first renders (after the data) and whenever the active tab changes.
  const tabFade = useScrollFade<HTMLDivElement>(`${tab}/${q.data ? 'ready' : 'pending'}`);
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="this loop" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  if (!q.data) return <p role="alert">No loop called “{id}”. <a href="#/" className="underline">Back to the fleet</a></p>;
  const loop = q.data;
  const tabs = tabsFor(loop);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <StatusBadge state={cardBadge(loop)} />{headerReason(loop) && <span data-testid="header-reason" style={{ color: 'var(--muted)' }}>{headerReason(loop)}</span>}
        {headerRound(loop) && <span data-testid="header-round" className="font-mono text-[12px]">{headerRound(loop)}</span>}
        {loop.runLimit > 0 && loop.run > 0 && loop.state !== 'done' && (
          <div className="w-48 max-w-full"><ProgressBar label="Run budget" value={Math.min(loop.run, loop.runLimit)} max={loop.runLimit} text={`Run ${loop.run}/${loop.runLimit}`} color="var(--accent)" /></div>
        )}
      </div>
      {(loop.url || loop.pages !== undefined) && (
        <p data-testid="site-line" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {loop.pages !== undefined && <span className="font-mono text-[13px]">{loop.pages} pages</span>}
          {loop.url && /^https?:\/\//.test(loop.url) && <a href={loop.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center underline sm:min-h-0" style={{ color: 'var(--accent)' }}>Visit live site<span className="sr-only"> (opens in a new tab)</span></a>}
        </p>
      )}
      {loop.paused && (
        <p role="status" data-testid="paused-notice" className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {statusLine(loop)}. Lane runs and the control room stop until it is resumed.
        </p>
      )}
      {loop.lanes && <ControlBar loop={loop} />}
      {loop.shipped ? <p data-testid="shipped-line" className="font-medium" style={{ color: 'var(--done)' }}>{releasedText(loop.shipped)}</p> : loop.ship && <ShipPanel ship={loop.ship} />}
      {loop.controlNotes && loop.controlNotes.length > 0 && (
        <section aria-labelledby="control-notes-h" className="space-y-1 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 id="control-notes-h" className="text-[13px] font-semibold">Control room notes</h2>
          <ul className="space-y-1">
            {loop.controlNotes.map((n) => (
              <li key={`${n.lane}/${n.at}`}><strong>{n.lane}</strong> <span style={{ color: 'var(--muted)' }}>{relativeTime(n.at)}</span><br />{n.text}</li>
            ))}
          </ul>
        </section>
      )}
      <div ref={tabFade.ref} onScroll={tabFade.onScroll} onFocus={tabFade.onFocus} role="tablist" aria-label="Loop sections" className="flex gap-1 overflow-x-auto whitespace-nowrap border-b" style={{ borderColor: 'var(--border)', ...tabFade.style }}>
        {tabs.map((t) => (
          <button key={t} type="button" role="tab" tabIndex={tab === t ? 0 : -1} onKeyDown={(e) => onTabKey(e, tabs, tab, setTab)} id={`tab-${t}`} aria-controls="loop-panel" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-t px-3 py-2 aria-selected:border-b-2 aria-selected:font-semibold" style={{ borderColor: 'var(--accent)' }}>{t}</button>
        ))}
      </div>
      <div role="tabpanel" id="loop-panel" aria-labelledby={`tab-${tab}`}><TabBody tab={tab} loop={loop} {...(focus && { focus })} toRuns={() => setTab('Runs')} /></div>
    </div>
  );
}
