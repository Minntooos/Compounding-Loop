import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MIN_BRIEF_SCORE } from '@core/brief';
import type { LoopDetail } from '@core/types';
import { postControl, streamDraftBrief } from '../api/client';
import { CHANGE_TEXT, githubUrl, slugOf } from '../lib/controls';
import { briefVerdict, draftInputsFor, draftPrompt, ingredientGroups } from '../lib/draft';
import { copyText } from './WelcomeStrip';
import { toast } from './Toasts';

type Stream = { kind: 'idle' } | { kind: 'streaming'; step: string } | { kind: 'done'; score: number } | { kind: 'failed'; error: string } | { kind: 'cancelled' };

const field = { background: 'var(--bg)', borderColor: 'var(--border)' };

const PRINT_PROMPT = 'npx compounding-loop next-round --draft --print-prompt';

/**
 * C6: start the next round from a brief. Shows what a draft is made from, lets Claude Code draft it (local, streamed
 * from `POST …/draft-brief`) or copies core's prompt (demo), scores the brief live, and keeps Go as its own click.
 * Drafting never starts a round and never writes to the repo.
 */
export function NextRoundDialog({ loop, local, onClose }: { loop: LoopDetail; local: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const abort = useRef<AbortController>(undefined);
  const qc = useQueryClient();
  const [brief, setBrief] = useState('');
  const [mine, setMine] = useState<string>();
  const [stream, setStream] = useState<Stream>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();
  // Committed but not pushed: the round is already written, so a Retry would start it twice; only pushing finishes it.
  const [committed, setCommitted] = useState(false);
  const close = useRef<HTMLButtonElement>(null);
  // The focused primary button goes away with the commit, so focus moves to Close instead of falling to the page.
  useEffect(() => { if (committed) close.current?.focus(); }, [committed]);
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    ref.current?.showModal();
    return () => { abort.current?.abort(); opener?.focus(); };
  }, []);

  const { inputs, complete } = useMemo(() => draftInputsFor(loop), [loop]);
  const groups = useMemo(() => ingredientGroups(inputs), [inputs]);
  const prompt = useMemo(() => draftPrompt(inputs), [inputs]);
  const verdict = briefVerdict(brief);
  const slug = slugOf(loop.repoUrl ?? loop.url);
  const url = !local && slug ? githubUrl('next-round', slug, { brief }) : undefined;
  const streaming = stream.kind === 'streaming';
  const blocked = !verdict.ok
    ? `Brief score ${verdict.score}; at least ${MIN_BRIEF_SCORE} is needed to start.`
    : !local && !url ? (slug ? 'This brief is too long for a prefilled GitHub link: shorten it, or start the round locally.' : 'This loop has no GitHub repository to open.') : undefined;

  async function draft() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStream({ kind: 'streaming', step: 'Starting…' });
    try {
      const result = await streamDraftBrief(loop.id, (step) => setStream({ kind: 'streaming', step }), controller.signal);
      // Keep the owner's own text across several drafts: Put back restores what they typed, not an earlier draft.
      setMine((m) => m ?? (brief.trim() ? brief : undefined));
      setBrief(result.draft);
      setStream({ kind: 'done', score: result.score });
    } catch (e) {
      if (controller.signal.aborted) setStream({ kind: 'cancelled' });
      else setStream({ kind: 'failed', error: e instanceof Error ? e.message : String(e) });
    }
  }

  // Without the DONE lists the prompt would tell Claude there are none, so the demo copies the command that prints the full one.
  const copied = complete ? prompt : PRINT_PROMPT;
  async function copyPrompt() {
    const pre = document.getElementById('draft-prompt');
    const ok = await copyText(copied, pre);
    if (!ok) pre?.closest('details')?.setAttribute('open', '');
    setNote(!ok ? 'Select the text below and copy it (Ctrl+C).'
      : complete ? 'Prompt copied. Paste it into Claude Code in your clone, then paste its brief into the box.'
      : 'Command copied. Run it in your clone: it prints the full prompt for Claude Code. Paste the brief Claude writes into the box.');
  }

  async function go() {
    if (!local) {
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      onClose();
      return;
    }
    setBusy(true); setError(undefined);
    try {
      const reply = await postControl(loop.id, 'next-round', { brief });
      await qc.invalidateQueries();
      // Lanes read main on GitHub: a commit that was not pushed has not started anything for them.
      if (reply.pushError || reply.pushed === false) { setCommitted(true); setError(`Committed here but not pushed${reply.pushError ? `: ${reply.pushError}` : ''}. Push main to finish.`); setBusy(false); return; }
      toast(`Round ${inputs.round} started`);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setBusy(false); }
  }

  const muted = { color: 'var(--muted)' };
  return (
    <dialog ref={ref} onClose={onClose} onCancel={(e) => { if (busy) e.preventDefault(); }} aria-labelledby="next-round-title" data-testid="control-dialog" className="w-[min(44rem,calc(100vw-2rem))] rounded-lg border p-4" style={{ background: 'var(--surface)', color: 'var(--text)', borderColor: 'var(--border)' }}>
      <h2 id="next-round-title" className="text-[15px] font-semibold">Start round {inputs.round}?</h2>
      <p className="mt-2">{CHANGE_TEXT['next-round']}</p>

      <details open className="mt-3 rounded border p-2" style={{ borderColor: 'var(--border)' }} data-testid="draft-ingredients">
        <summary className="min-h-11 cursor-pointer content-center font-medium">Ingredients</summary>
        <div className="space-y-2 text-[13px]">
          {groups.map((g) => (
            <section key={g.id} aria-label={`${g.title}, ${g.items.length}`}>
              <h3 className="font-medium">{g.title} · {g.items.length}</h3>
              {g.items.length > 0
                ? <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5" style={muted}>{g.items.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul>
                : <p style={muted}>None</p>}
            </section>
          ))}
          {!complete && <p style={muted}>This view has no DONE next-10 lists or last round’s out-of-scope; {local ? 'Draft with Claude reads them from the repo.' : <>run <code className="font-mono">{PRINT_PROMPT}</code> in your clone for the full prompt.</>}</p>}
        </div>
      </details>

      <label className="mt-3 block text-[13px]" htmlFor="next-brief">Brief for round {inputs.round}</label>
      <textarea id="next-brief" value={brief} onChange={(e) => setBrief(e.target.value)} rows={16} readOnly={streaming} aria-describedby="brief-score" className="mt-1 block w-full rounded border p-2 font-mono text-[13px] max-md:h-56" style={field} />
      <p id="brief-score" data-testid="brief-score" className="mt-1 flex items-start gap-1.5 text-[13px]" style={{ color: verdict.ok ? 'var(--text)' : 'var(--muted)' }}>
        {verdict.ok ? <Check aria-hidden size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--done)' }} /> : <AlertTriangle aria-hidden size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--blocked)' }} />}
        <span>Brief score {verdict.score}/100 (needs {MIN_BRIEF_SCORE}){!verdict.ok && verdict.missing ? ` · ${verdict.missing}` : ''}</span>
      </p>

      {local ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {streaming
            ? <button type="button" onClick={() => abort.current?.abort()} className="min-h-11 rounded border px-4" style={{ borderColor: 'var(--border)' }}>Stop</button>
            : <button type="button" disabled={busy} onClick={() => void draft()} className="min-h-11 rounded border px-4 disabled:opacity-60" style={{ borderColor: 'var(--accent)' }}>{stream.kind === 'failed' ? 'Retry draft' : 'Draft with Claude'}</button>}
          {stream.kind === 'done' && mine !== undefined && <button type="button" onClick={() => { setBrief(mine); setMine(undefined); setStream({ kind: 'idle' }); }} className="min-h-11 rounded border px-4" style={{ borderColor: 'var(--border)' }}>Put back my text</button>}
          <p role="status" data-testid="draft-status" className="basis-full text-[13px]" style={muted}>
            {stream.kind === 'streaming' ? stream.step
              : stream.kind === 'done' ? `Draft ready · score ${stream.score}/100. Edit it, then start the round.`
              : stream.kind === 'cancelled' ? 'Stopped. Nothing was written; Claude Code may finish its run in the background for a few minutes.'
              : stream.kind === 'idle' ? 'Claude Code reads the repo and drafts a brief here (a few minutes). Nothing is written until you start the round.' : ''}
          </p>
          {stream.kind === 'failed' && <p role="alert" className="basis-full text-[13px]" style={{ color: 'var(--failing)' }}>Draft failed: {stream.error}</p>}
        </div>
      ) : (
        <div className="mt-3 text-[13px]">
          <button type="button" onClick={() => void copyPrompt()} className="min-h-11 rounded border px-4" style={{ borderColor: 'var(--accent)' }}>{complete ? 'Copy prompt for Claude Code' : 'Copy the prompt command'}</button>
          {note && <p role="status" className="mt-1" style={muted}>{note}</p>}
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer content-center">{complete ? 'Show the prompt' : 'Show the command'}</summary>
            <pre id="draft-prompt" className="max-h-48 overflow-auto whitespace-pre-wrap rounded border p-2 font-mono text-[12px]" style={field}>{copied}</pre>
          </details>
          <p className="mt-1" style={muted}>GitHub opens on a page you still have to submit. Nothing is sent from this dashboard.</p>
        </div>
      )}

      {blocked && <p id="next-round-blocked" className="mt-2 text-[13px]" style={muted}>{blocked}</p>}
      {error && <p role="alert" className="mt-2 text-[13px]" style={{ color: 'var(--failing)' }}>{error}</p>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button ref={close} type="button" disabled={busy} onClick={onClose} className="min-h-11 rounded border px-4 disabled:opacity-60" style={{ borderColor: 'var(--border)' }}>{committed ? 'Close' : 'Cancel'}</button>
        {!committed && <button type="button" disabled={busy || streaming || blocked !== undefined} aria-describedby={blocked ? 'next-round-blocked' : undefined} onClick={() => void go()} className="min-h-11 rounded px-4 font-semibold disabled:opacity-60" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>{busy ? 'Starting…' : error ? 'Retry' : `Start round ${inputs.round}`}</button>}
      </div>
    </dialog>
  );
}
