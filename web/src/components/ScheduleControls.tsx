import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { canWrite, postSchedule } from '../api/client';
import { scheduleButtons, scheduleEditUrl, scheduleToast, snoozePresets, type LaneScheduleKind, type ScheduleButton } from '../lib/schedule';
import { notPushedText } from '../lib/controls';
import { toast } from './Toasts';

const LABEL: Record<ScheduleButton, string> = { pause: 'Pause lane', resume: 'Resume', snooze: 'Snooze until…', wake: 'Wake now' };
const button = 'min-h-11 rounded border px-3 text-[13px] font-medium disabled:opacity-60';

/**
 * C5: the buttons under a lane's schedule sentence. Local: each one posts to the server, which edits `.ai/schedule.json` with
 * core's code and commits; Pause asks once (it stops work), Snooze and Wake act at once (the opposite button undoes them).
 * Demo: one link to GitHub's editor for `schedule.json` (GitHub cannot prefill an edit, and the edit is core's, not ours).
 */
export function ScheduleControls({ loopId, lane, kind, slug, now }: { loopId: string; lane: string; kind: LaneScheduleKind; slug?: string; now: Date }) {
  const qc = useQueryClient();
  const write = useQuery({ queryKey: ['canWrite'], queryFn: canWrite });
  const local = write.data === true;
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<'confirm-pause' | 'snooze'>();
  const [error, setError] = useState<string>();
  const group = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  // The clicked button disappears when the inline step opens or closes: focus its first button, so keyboard users stay here.
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    group.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [open, busy]);
  // A refreshed row (another tab, SSE) can change the lane's state: an open step for the old state is gone.
  useEffect(() => setOpen(undefined), [kind]);
  const step = (next: typeof open) => { moved.current = true; setOpen(next); };
  const actions = scheduleButtons(kind);
  if (actions.length === 0 || write.data === undefined) return null;

  if (!local) {
    if (!slug) return null;
    return (
      <a data-testid="schedule-edit" href={scheduleEditUrl(slug)} target="_blank" rel="noopener noreferrer" className={`${button} inline-flex items-center`} style={{ borderColor: 'var(--border)' }}>
        Edit schedule on GitHub<span className="sr-only"> (opens GitHub in a new tab)</span>
      </a>
    );
  }

  async function run(action: ScheduleButton, until?: { label: string; until: string }) {
    setBusy(true); setError(undefined);
    try {
      const reply = await postSchedule(loopId, { action, lane, ...(until && { until: until.until }) });
      // Wait for the refreshed row, so the old buttons never come back enabled for a second post.
      await qc.invalidateQueries();
      moved.current = true;
      setOpen(undefined);
      // Lanes read main on GitHub: a schedule change that was committed but not pushed has not reached them.
      if (reply.pushError || reply.pushed === false) setError(notPushedText(loopId, reply.pushError));
      else toast(scheduleToast(action, lane, reply.changed !== false, until?.label));
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  }

  return (
    <div ref={group} data-testid="schedule-controls" className="flex flex-wrap items-center gap-2" role="group" aria-label={`Schedule of ${lane}`}>
      {open === undefined && actions.map((a) => (
        <button key={a} type="button" disabled={busy} aria-label={`${LABEL[a]} ${lane}`} aria-expanded={a === 'pause' || a === 'snooze' ? false : undefined} onClick={() => (a === 'pause' ? step('confirm-pause') : a === 'snooze' ? step('snooze') : void run(a))} className={button} style={{ borderColor: 'var(--border)' }}>{LABEL[a]}</button>
      ))}
      {open === 'confirm-pause' && (
        <>
          <span role="status" className="text-[13px]">Pause {lane}? It skips every run until you resume it.</span>
          <button type="button" disabled={busy} onClick={() => void run('pause')} className={button} style={{ borderColor: 'var(--blocked)' }}>Confirm pause</button>
          <button type="button" disabled={busy} onClick={() => step(undefined)} className={button} style={{ borderColor: 'var(--border)' }}>Cancel</button>
        </>
      )}
      {open === 'snooze' && (
        <>
          <span role="status" className="text-[13px]">Snooze {lane} for</span>
          {snoozePresets(now).map((p) => (
            <button key={p.until} type="button" disabled={busy} onClick={() => void run('snooze', p)} className={button} style={{ borderColor: 'var(--border)' }}>{p.label}</button>
          ))}
          <button type="button" disabled={busy} onClick={() => step(undefined)} className={button} style={{ borderColor: 'var(--border)' }}>Cancel</button>
        </>
      )}
      {error && <p role="alert" data-testid="schedule-error" className="basis-full text-[13px]" style={{ color: 'var(--failing)' }}>{error}</p>}
    </div>
  );
}
