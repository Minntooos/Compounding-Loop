import type { LaneStatus, Schedule, SteerEntry } from '@core/types';
import { AlarmClock, Check, Circle, CircleSlash, Clock, Lock, LockOpen, Moon, Pause, ShipWheel, TriangleAlert } from 'lucide-react';
import { relativeTime } from '../lib/format';
import { claimText, describeUnanswered } from '../lib/lanes';
import { LaneBadge } from './LaneBadge';
import { ScheduleControls } from './ScheduleControls';
import { ProgressBar } from './ProgressBar';
import { openSteer } from '../lib/steerEvents';
import { laneScheduleState, steerAckChip, type LaneScheduleKind } from '../lib/schedule';
import { timeUtc, dayHeading } from '../lib/timeline';

const SCHEDULE_ICON: Record<LaneScheduleKind, typeof Clock> = { due: Clock, stopped: CircleSlash, 'loop-paused': Pause, paused: Pause, sleeping: Moon, snoozed: AlarmClock };
const ACK_ICON = { done: Check, blocked: TriangleAlert, muted: Circle } as const;

export interface LanesCockpit {
  schedule?: Schedule;
  idleRuns?: Record<string, number>;
  steer?: { lane: string; entries: SteerEntry[] }[];
  /** `.ai/PAUSED` exists: every lane is held. */
  loopPaused?: boolean;
  now?: Date;
  /** For the C5 buttons: the loop they act on and its GitHub repo (the demo's link). */
  loopId?: string;
  slug?: string;
}

function laneSchedule(status: LaneStatus, cockpit: LanesCockpit) {
  const entry = cockpit.schedule?.lanes[status.name];
  const idle = cockpit.idleRuns?.[status.name];
  return laneScheduleState({ ...(entry && { entry }), ...(idle !== undefined && { idleRuns: idle }), ...(cockpit.loopPaused && { loopPaused: true }), laneState: status.state, now: cockpit.now ?? new Date() });
}

function ScheduleLine({ state }: { state: ReturnType<typeof laneScheduleState> }) {
  const Icon = SCHEDULE_ICON[state.kind];
  return (
    <span data-testid="lane-schedule" data-kind={state.kind} className="inline-flex items-start gap-1.5 text-[13px] [overflow-wrap:anywhere]" style={{ color: state.kind === 'due' ? 'var(--text)' : 'var(--muted)' }}>
      <Icon aria-hidden size={14} className="mt-[3px] shrink-0" /><span>{state.text}</span>
    </span>
  );
}

// Steer text is repo text: text nodes only.
function SteerHistory({ lane, entries, laneState }: { lane: string; entries: SteerEntry[]; laneState: LaneStatus['state'] }) {
  if (entries.length === 0) return null;
  const waiting = laneState === 'done' ? 0 : entries.filter((e) => !e.ack).length;
  return (
    <details data-testid="steer-history" className="mt-2">
      <summary className="min-h-11 cursor-pointer py-2 text-[13px] font-medium">Steer history · {entries.length}{waiting > 0 ? ` · ${waiting} waiting` : ''}</summary>
      <ol aria-label={`Steer history of ${lane}`} className="space-y-2">
        {entries.map((e, i) => {
          const chip = steerAckChip(e.ack, laneState);
          const Icon = ACK_ICON[chip.tone];
          return (
            <li key={i} data-testid="steer-entry" className="rounded border p-2 text-[13px]" style={{ borderColor: 'var(--border)' }}>
              <p className="font-mono text-[12px]" style={{ color: 'var(--muted)' }}>{dayHeading(e.at.slice(0, 10))} {timeUtc(e.at)} · {e.author} · {e.scope === 'standing' ? 'standing' : 'next run'}</p>
              <p className="mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]">{e.text}</p>
              <p data-testid="steer-ack" className="mt-1 inline-flex items-start gap-1 text-[12px] [overflow-wrap:anywhere]" style={{ color: `var(--${chip.tone})` }}>
                <Icon aria-hidden size={13} className="mt-[2px] shrink-0" /><span>{chip.text}</span>
              </p>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

// Lane names, commit subjects and message text come from repo files: rendered as text nodes only.
function LaneRow({ lane, cockpit }: { lane: LaneStatus; cockpit: LanesCockpit }) {
  const schedule = cockpit.schedule || cockpit.idleRuns || cockpit.loopPaused ? laneSchedule(lane, cockpit) : undefined;
  return (
    <li data-testid="lane-row" className="rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="break-all font-mono text-[14px] font-semibold">{lane.name}</h3>
        <LaneBadge state={lane.state} />
        <span className="font-mono text-[12px]">Run {lane.run}/{lane.limit}</span>
        <span data-testid="lane-claim" className="font-mono text-[12px]" style={{ color: lane.claim ? 'var(--text)' : 'var(--muted)' }}>{claimText(lane.claim)}</span>
        <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--muted)' }}>
          {lane.locked ? <Lock aria-hidden size={13} /> : <LockOpen aria-hidden size={13} />}{lane.locked ? 'Locked' : 'No lock'}
        </span>
        {schedule && <ScheduleLine state={schedule} />}
        <button type="button" onClick={() => openSteer(lane.name)} aria-label={`Steer ${lane.name}`} className="ml-auto min-h-11 rounded border px-3 text-[13px] font-medium" style={{ borderColor: 'var(--border)' }}><span className="inline-flex items-center gap-1.5"><ShipWheel aria-hidden size={14} />Steer</span></button>
      </div>
      {schedule && cockpit.loopId && <ScheduleControls loopId={cockpit.loopId} lane={lane.name} kind={schedule.kind} {...(cockpit.slug && { slug: cockpit.slug })} now={cockpit.now ?? new Date()} />}
      {lane.limit > 0 && <div className="mt-2"><ProgressBar label={`${lane.name} run budget`} value={Math.min(lane.run, lane.limit)} max={lane.limit} text={`${lane.run} of ${lane.limit} runs`} color="var(--accent)" /></div>}
      <p className="mt-1 [overflow-wrap:anywhere]" style={{ color: 'var(--muted)' }}>
        {lane.lastCommit
          ? <><code className="font-mono text-[12px]">{lane.lastCommit.sha.slice(0, 7)}</code> {lane.lastCommit.subject} · {relativeTime(lane.lastCommit.at)}</>
          : 'No commits yet'}
      </p>
      {lane.unanswered.length > 0 && (
        <ul aria-label={`Unanswered messages to ${lane.name}`} className="mt-2 space-y-1">
          {lane.unanswered.map((u, i) => (
            <li key={i} data-testid="lane-unanswered" className="[overflow-wrap:anywhere] text-[13px]" style={{ color: 'var(--blocked)' }}>{describeUnanswered(u)}</li>
          ))}
        </ul>
      )}
      <SteerHistory lane={lane.name} entries={cockpit.steer?.find((s) => s.lane === lane.name)?.entries ?? []} laneState={lane.state} />
    </li>
  );
}

export function LanesTab({ lanes, cockpit = {} }: { lanes: LaneStatus[]; cockpit?: LanesCockpit }) {
  return <ul className="space-y-2" aria-label="Lanes">{lanes.map((l) => <LaneRow key={l.name} lane={l} cockpit={cockpit} />)}</ul>;
}
