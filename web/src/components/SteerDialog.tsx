import { useEffect, useRef, useState } from 'react';
import type { LoopDetail, SteerScope } from '@core/types';
import { slugOf } from '../lib/controls';
import { steerCommand, steerDraft, steerEditUrl, steerNewFileUrl } from '../lib/steer';
import { copyText } from './WelcomeStrip';
import { toast } from './Toasts';

const blockedText = (text: string) => (text.trim() === '' ? 'Type what the lane should do.' : undefined);

const field = { background: 'var(--bg)', borderColor: 'var(--border)' };

/**
 * C4: tell a lane what to do in one sentence. The preview is core's own formatter output, so what you see is what lands in steer.md.
 * Demo: copies the entry and opens GitHub's editor for the file. Local: copies the `loop steer` command (it saves, wakes the lane and commits).
 */
export function SteerDialog({ loop, lane: initialLane, local, onClose }: { loop: LoopDetail; lane?: string; local: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const lanes = (loop.lanes ?? []).map((l) => l.name);
  const [lane, setLane] = useState(initialLane && lanes.includes(initialLane) ? initialLane : lanes[0] ?? '');
  const [unit, setUnit] = useState('');
  const [scope, setScope] = useState<SteerScope>('next-run');
  const [text, setText] = useState('');
  const [author, setAuthor] = useState(local ? '' : 'owner');
  const [note, setNote] = useState('');
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    ref.current?.showModal();
    return () => opener?.focus();
  }, []);

  const slug = slugOf(loop.repoUrl ?? loop.url);
  // Locally an empty name means core fills in git user.name; the preview says so in the heading.
  const draft = steerDraft({ lane, unit, scope, text, author: author.trim() || (local ? '<your git user.name>' : 'owner'), at: new Date() });
  const createUrl = !local && slug && !blockedText(text) ? steerNewFileUrl(slug, lane, draft.entry) : undefined;
  const command = steerCommand({ lane, unit, scope, text, author });
  const empty = blockedText(text) !== undefined;
  const blocked = blockedText(text) ?? (!local && !slug ? 'This loop has no GitHub repository to open.' : undefined);

  async function act() {
    if (local) {
      const ok = await copyText(command, document.getElementById('steer-command'));
      setNote(ok ? 'Command copied. Run it in the repo: it saves the entry, wakes the lane and commits.' : 'Select the command above and copy it (Ctrl+C).');
      if (ok) toast(`Steer command for ${lane} copied`);
      return;
    }
    // Open first, inside the click: a popup opened after an await can be blocked.
    if (slug) window.open(steerEditUrl(slug, lane), '_blank', 'noopener,noreferrer');
    const ok = await copyText(draft.entry, document.getElementById('steer-preview'));
    setNote(ok ? 'Entry copied. On GitHub, paste it on the line under the intro, then commit.' : 'Copy the entry above, paste it under the intro on GitHub, then commit.');
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="steer-title" data-testid="steer-dialog" className="w-[min(36rem,calc(100vw-2rem))] rounded-lg border p-4" style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}>
      <h2 id="steer-title" className="text-[15px] font-semibold">Steer a lane</h2>
      <p className="mt-1 text-[13px]" style={{ color: 'var(--muted)' }}>The lane reads it at the start of its next run and answers under it.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="text-[13px]">
          <label htmlFor="steer-lane">Lane</label>
          <select id="steer-lane" value={lane} onChange={(e) => setLane(e.target.value)} className="mt-1 block min-h-11 w-full rounded border px-2" style={field}>
            {lanes.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <label className="block text-[13px]">Unit (optional)
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="e.g. 4" className="mt-1 block min-h-11 w-full rounded border px-2" style={field} />
        </label>
      </div>
      <fieldset className="mt-3">
        <legend className="text-[13px]">Timing</legend>
        <div className="mt-1 inline-flex rounded border" style={{ borderColor: 'var(--border)' }}>
          {(['next-run', 'standing'] as const).map((s) => (
            <label key={s} className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-[13px] has-[:checked]:font-semibold" style={scope === s ? { background: 'var(--border)' } : undefined}>
              <input type="radio" name="steer-scope" value={s} checked={scope === s} onChange={() => setScope(s)} />
              {s === 'next-run' ? 'Next run' : 'Standing'}
            </label>
          ))}
        </div>
        <p className="mt-1 text-[12px]" style={{ color: 'var(--muted)' }}>{scope === 'next-run' ? 'Done once, before the lane’s own units.' : 'Applies to every run until you remove it.'}</p>
      </fieldset>
      <label className="mt-3 block text-[13px]">Tell the lane what to do, in plain words
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="mt-1 block w-full rounded border p-2 text-[14px]" style={field} />
      </label>
      <label className="mt-3 block text-[13px]">Your name{local && ' (empty: your git user.name)'}
        <input value={author} onChange={(e) => setAuthor(e.target.value)} className="mt-1 block min-h-11 w-full rounded border px-2" style={field} />
      </label>
      <p className="mt-3 text-[13px]">Preview · <code className="font-mono text-[12px]">{draft.path}</code></p>
      <pre id="steer-preview" data-testid="steer-preview" className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-[12px] [overflow-wrap:anywhere]" style={field}>{draft.entry}</pre>
      {local && !empty && (
        <>
          <p className="mt-3 text-[13px]">Command (bash, zsh, Git Bash)</p>
          <pre id="steer-command" data-testid="steer-command" className="mt-1 whitespace-pre-wrap rounded border p-2 font-mono text-[12px] [overflow-wrap:anywhere]" style={field}>{command}</pre>
        </>
      )}
      {!local && (
        <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
          GitHub opens on a page you still have to commit. Nothing is sent from this dashboard.
          {createUrl && <> No steer.md in this repo yet? <a data-testid="steer-create" href={createUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: 'var(--accent)' }}>Create it with this entry<span className="sr-only"> (opens GitHub in a new tab)</span></a>.</>}
        </p>
      )}
      {blocked && <p role="status" className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>{blocked}</p>}
      {note && <p role="status" data-testid="steer-note" className="mt-2 text-[13px]">{note}</p>}
      <div className="sticky -bottom-4 -mx-4 -mb-4 mt-4 flex flex-wrap justify-end gap-2 border-t p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button type="button" onClick={onClose} className="min-h-11 rounded border px-4" style={{ borderColor: 'var(--border)' }}>{note ? 'Close' : 'Cancel'}</button>
        <button type="button" disabled={blocked !== undefined} onClick={() => void act()} className="min-h-11 rounded px-4 font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>{local ? 'Copy command' : 'Edit on GitHub'}</button>
      </div>
    </dialog>
  );
}
