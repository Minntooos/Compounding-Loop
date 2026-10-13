import type { Pace } from '@core/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Gauge } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { hasServer, postPace } from '../api/client';
import { lanePace, PACE_DOWNSHIFT, PACE_FLOOR, PACE_SUMMARY, PACE_WORD, PACES, paceEditUrl, paceFileText, paceToast, type LoopPace } from '../lib/pace';
import { toast } from './Toasts';
import { copyText } from './WelcomeStrip';

const button = 'min-h-11 rounded border px-3 text-[13px] font-medium disabled:opacity-60';

/**
 * C9: the inline chooser under the Pace block (loop pace) or a lane row (that lane's own pace). Local: posts to the server,
 * which writes `.ai/policy.json` with core's code and commits. Demo: opens GitHub's editor for policy.json and copies the
 * whole new file (GitHub cannot prefill an edit of an existing file).
 */
export function PaceChooser({ loopId, pace, lane, slug, onClose }: { loopId: string; pace: LoopPace; lane?: string; slug?: string; onClose: () => void }) {
  const qc = useQueryClient();
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  const local = server.data === true;
  const current = lane ? lanePace(pace, lane).pace : pace.pace;
  const [picked, setPicked] = useState<Pace>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  const name = useId();
  const first = useRef<HTMLInputElement>(null);
  // Opening moves focus into the choices, so keyboard users land on what they opened.
  useEffect(() => first.current?.focus(), []);

  async function save() {
    setBusy(true); setError(undefined);
    try {
      const reply = await postPace(loopId, { pace: picked, ...(lane && { lane }) });
      await qc.invalidateQueries();
      setBusy(false);
      // Lanes read main on GitHub: a pace that was committed but not pushed has not reached them.
      if (reply.pushError || reply.pushed === false) { setError(`Committed here but not pushed${reply.pushError ? `: ${reply.pushError}` : ''}. Push main so the lanes see it.`); return; }
      toast(paceToast(picked, lane, reply.changed !== false, pace.pace));
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  async function edit() {
    if (!slug) return;
    // Open first, inside the click: a popup opened after an await can be blocked.
    window.open(paceEditUrl(slug), '_blank', 'noopener,noreferrer');
    const ok = await copyText(paceFileText(pace, picked, lane), document.getElementById(`${name}-file`));
    setNote(ok ? 'Policy copied. On GitHub, check the other lanes’ entries still match (this page can be older), select all, paste, then commit.' : 'Copy the policy below; on GitHub check the other lanes’ entries still match, select all, paste and commit.');
  }

  return (
    <div data-testid="pace-chooser" onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.stopPropagation(); onClose(); } }} className="mt-2 basis-full rounded border p-3" style={{ borderColor: 'var(--border)' }}>
      <fieldset>
        <legend className="text-[14px] font-semibold">{lane ? `Pace for ${lane}` : 'Pace for every lane'}</legend>
        <div className="mt-2 space-y-1">
          {PACES.map((p) => (
            <label key={p} className="flex min-h-11 cursor-pointer items-start gap-2 rounded px-1 py-1.5">
              <input ref={p === current ? first : undefined} type="radio" name={name} value={p} checked={picked === p} onChange={() => { setPicked(p); setNote(undefined); }} className="mt-1 size-4 shrink-0" style={{ accentColor: 'var(--accent)' }} />
              <span>
                <span className="text-[14px] font-semibold">{PACE_WORD[p]}</span>
                {p === current && <span className="text-[12px]" style={{ color: 'var(--muted)' }}> · current</span>}
                {lane && p === pace.pace && p !== current && <span className="text-[12px]" style={{ color: 'var(--muted)' }}> · the loop’s pace</span>}
                <span className="block text-[13px]" style={{ color: 'var(--muted)' }}>{PACE_SUMMARY[p]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{PACE_FLOOR} {PACE_DOWNSHIFT}</p>
      {/* core's policy writer keeps no `reason`, so any new pace (local save or the demo's file) drops the note. */}
      {pace.note && <p data-testid="pace-note-clears" className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>A new pace clears the “Why this pace” note.</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {local
          ? <button type="button" data-testid="pace-save" disabled={busy || picked === current} onClick={() => void save()} className={button} style={{ borderColor: 'var(--accent)' }}>Save pace</button>
          : slug && <button type="button" data-testid="pace-edit" disabled={picked === current} onClick={() => void edit()} className={button} style={{ borderColor: 'var(--accent)' }}>Edit on GitHub<span className="sr-only"> (opens GitHub in a new tab)</span></button>}
        <button type="button" disabled={busy} onClick={onClose} className={button} style={{ borderColor: 'var(--border)' }}>Cancel</button>
      </div>
      {!local && note && <p role="status" className="mt-2 text-[13px]">{note}</p>}
      {/* The demo's new policy.json, shown before the copy so a blocked clipboard can select it instead. */}
      {!local && slug && picked !== current && <pre id={`${name}-file`} data-testid="pace-file" tabIndex={0} aria-label="New policy.json" className="mt-2 overflow-x-auto rounded border p-2 font-mono text-[12px]" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>{paceFileText(pace, picked, lane)}</pre>}
      {error && <p role="alert" data-testid="pace-error" className="mt-2 text-[13px]" style={{ color: 'var(--failing)' }}>{error}</p>}
    </div>
  );
}

/** The Pace block at the head of the Lanes tab: the loop's pace in one sentence, its plain line, why it was last set, and Change pace. */
export function PaceBlock({ loopId, pace, slug }: { loopId: string; pace: LoopPace; slug?: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const close = () => { setOpen(false); window.setTimeout(() => opener.current?.focus(), 0); };
  return (
    <section data-testid="pace-block" aria-labelledby="pace-h" className="mb-3 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 id="pace-h" className="inline-flex items-center gap-1.5 text-[14px] font-semibold"><Gauge aria-hidden size={15} />Pace: {PACE_WORD[pace.pace]}</h3>
        <span className="text-[13px]" style={{ color: 'var(--muted)' }}>every lane, unless it has its own</span>
        {!open && <button ref={opener} type="button" onClick={() => setOpen(true)} className={`${button} ml-auto`} style={{ borderColor: 'var(--border)' }}>Change pace</button>}
      </div>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>{PACE_SUMMARY[pace.pace]}</p>
      {pace.note && <p data-testid="pace-note" className="mt-1 break-words text-[13px]">Why this pace: {pace.note}</p>}
      {open && <PaceChooser loopId={loopId} pace={pace} {...(slug && { slug })} onClose={close} />}
    </section>
  );
}
