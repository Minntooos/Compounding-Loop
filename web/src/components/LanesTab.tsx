import type { LaneStatus } from '@core/types';
import { Lock, LockOpen } from 'lucide-react';
import { relativeTime } from '../lib/format';
import { describeUnanswered } from '../lib/lanes';
import { LaneBadge } from './LaneBadge';

// Lane names, commit subjects and message text come from repo files: rendered as text nodes only.
function LaneRow({ lane }: { lane: LaneStatus }) {
  return (
    <li data-testid="lane-row" className="rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h3 className="break-all font-mono text-[14px] font-semibold">{lane.name}</h3>
        <LaneBadge state={lane.state} />
        <span className="font-mono text-[12px]">Run {lane.run}/{lane.limit}</span>
        <span className="inline-flex items-center gap-1 text-[12px]" style={{ color: 'var(--muted)' }}>
          {lane.locked ? <Lock aria-hidden size={13} /> : <LockOpen aria-hidden size={13} />}{lane.locked ? 'Locked' : 'No lock'}
        </span>
      </div>
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
    </li>
  );
}

export function LanesTab({ lanes }: { lanes: LaneStatus[] }) {
  return <ul className="space-y-2" aria-label="Lanes">{lanes.map((l) => <LaneRow key={l.name} lane={l} />)}</ul>;
}
