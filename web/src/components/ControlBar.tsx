import { useQueryClient } from '@tanstack/react-query';
import { ShipWheel } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { LoopDetail } from '@core/types';
import { canWrite, postControl } from '../api/client';
import { toast } from './Toasts';
import { SteerDialog } from './SteerDialog';
import { NextRoundDialog } from './NextRoundDialog';
import { onSteer } from '../lib/steerEvents';
import { CHANGE_TEXT, githubUrl, notPushedText, releaseBlocker, slugOf, VERB, type ControlAction } from '../lib/controls';

const PENDING: Record<ControlAction, string> = { pause: 'Pausing…', resume: 'Resuming…', 'next-round': 'Starting…', release: 'Opening…' };

const DONE: Record<ControlAction, string> = { pause: 'Paused: lane runs will stop until you resume', resume: 'Resumed: lane runs continue on their next schedule', 'next-round': 'Next round started', release: 'Release workflow opened' };

type SimpleAction = Exclude<ControlAction, 'next-round'>;

function ConfirmDialog({ loop, action, local, onClose }: { loop: LoopDetail; action: SimpleAction; local: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const qc = useQueryClient();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  // Committed but not pushed: the change is already written, so a Retry would commit it again; only pushing finishes it.
  const [committed, setCommitted] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  // The focused primary button goes away with the commit, so focus moves to Close instead of falling to the page.
  useEffect(() => { if (committed) close.current?.focus(); }, [committed]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    ref.current?.showModal();
    return () => opener?.focus();
  }, []);
  const slug = slugOf(loop.repoUrl ?? loop.url);
  const url = (!local || action === 'release') && slug ? githubUrl(action, slug, { reason }) : undefined;
  const blocked = (!local || action === 'release') && !url ? 'This loop has no GitHub repository to open.' : undefined;

  async function confirm() {
    if (local && action !== 'release') {
      setBusy(true); setError(undefined);
      try {
        const reply = await postControl(loop.id, action, action === 'pause' ? { reason: reason || undefined } : {});
        await qc.invalidateQueries();
        // Lanes read main on GitHub: a commit that was not pushed has not changed anything for them.
        if (reply.pushError || reply.pushed === false) { setCommitted(true); setError(notPushedText(loop.id, reply.pushError)); setBusy(false); return; }
        if (reply.changed === false) { setError('Nothing to change: it was already in that state.'); setBusy(false); return; }
        toast(DONE[action]);
        onClose();
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
      return;
    }
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    onClose();
  }

  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }} aria-labelledby="control-title" data-testid="control-dialog" className="w-[min(32rem,calc(100vw-2rem))] rounded-lg border p-4" style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}>
      <h2 id="control-title" className="text-[15px] font-semibold">{VERB[action]}?</h2>
      <p className="mt-2">{CHANGE_TEXT[action]}</p>
      {!local && <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>GitHub opens on a page you still have to submit. Nothing is sent from this dashboard.</p>}
      {action === 'pause' && (
        <label className="mt-3 block text-[13px]">Reason (optional)
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block min-h-11 w-full rounded border px-2" style={{ background: 'var(--bg)', borderColor: 'var(--border)' }} />
        </label>
      )}
      {blocked && <p role="status" className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{blocked}</p>}
      {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: 'var(--failing)' }}>{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button ref={close} type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded border px-4 disabled:opacity-60" style={{ borderColor: 'var(--border)' }}>{committed ? 'Close' : 'Cancel'}</button>
        {!committed && <button type="button" disabled={busy || blocked !== undefined} onClick={() => void confirm()} className="min-h-11 rounded px-4 font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>{busy ? PENDING[action] : error ? 'Retry' : VERB[action]}</button>}
      </div>
    </dialog>
  );
}

/** Pause/Resume, Start next round and Release for a laned loop. Each asks first and says what changes; none holds a token. */
export function ControlBar({ loop }: { loop: LoopDetail }) {
  const [action, setAction] = useState<ControlAction>();
  const [local, setLocal] = useState(false);
  const [steer, setSteer] = useState<{ lane?: string }>();
  useEffect(() => { void canWrite().then(setLocal); }, []);
  useEffect(() => onSteer((lane) => setSteer(lane ? { lane } : {})), []);
  // Once the version has shipped there is nothing to release: no disabled button with a stale reason.
  const blocker = loop.shipped ? undefined : releaseBlocker(loop);
  const btn = 'min-h-11 rounded border px-3 text-[13px] font-medium disabled:opacity-60';
  return (
    <div className="space-y-1" data-testid="control-bar">
      <div className="flex flex-wrap gap-2">
        {loop.paused
          ? <button type="button" className={btn} style={{ borderColor: 'var(--accent)' }} onClick={() => setAction('resume')}>Resume</button>
          : <button type="button" className={btn} style={{ borderColor: 'var(--border)' }} onClick={() => setAction('pause')}>Pause all</button>}
        <button type="button" className={btn} style={{ borderColor: 'var(--border)' }} onClick={() => setAction('next-round')}>Start next round</button>
        <button type="button" className={btn} style={{ borderColor: 'var(--border)' }} onClick={() => setSteer({})} aria-keyshortcuts="s"><span className="inline-flex items-center gap-1.5"><ShipWheel aria-hidden size={14} />Steer</span></button>
        {!loop.shipped && <button type="button" className={btn} style={{ borderColor: 'var(--border)' }} disabled={blocker !== undefined} onClick={() => setAction('release')}>Release</button>}
      </div>
      {blocker && <p className="text-[12px]" style={{ color: 'var(--muted)' }}>{blocker}</p>}
      {steer && <SteerDialog loop={loop} {...(steer.lane && { lane: steer.lane })} local={local} onClose={() => setSteer(undefined)} />}
      {action === 'next-round' && <NextRoundDialog loop={loop} local={local} onClose={() => setAction(undefined)} />}
      {action && action !== 'next-round' && <ConfirmDialog loop={loop} action={action} local={local} onClose={() => setAction(undefined)} />}
    </div>
  );
}
