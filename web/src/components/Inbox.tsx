import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { InboxItem } from '@core/types';
import { api, hasServer, postAnswer } from '../api/client';
import { editFileUrl } from '../../../src/server/controls.js';
import { slugOf } from '../lib/controls';
import { attentionItems, describeAttention } from '../lib/lanes';
import { relativeTime } from '../lib/format';
import { LoadError, Loading } from './QueryState';

function Item({ item, selected, answer, onAnswer, onDone, readOnly, slug }: { item: InboxItem; selected: boolean; answer: string; onAnswer: (v: string) => void; onDone: (msg: string) => void; readOnly: boolean; slug?: string }) {
  const qc = useQueryClient();
  const send = useMutation({
    mutationFn: (text: string) => postAnswer(item.loopId, item.file, text),
    onSuccess: (r) => {
      onDone(`Answered ${item.loopId}${r.pushed ? ' and pushed' : ' (committed, not pushed)'}.`);
      for (const key of ['inbox', 'loops', 'loop', 'checks']) void qc.invalidateQueries({ queryKey: [key] });
    },
  });
  return (
    <li data-selected={selected} aria-current={selected ? 'true' : undefined} className="space-y-3 rounded-lg border p-4 data-[selected=true]:border-[var(--accent)]" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex justify-between gap-2"><a href={`#/loop/${encodeURIComponent(item.loopId)}`} className="font-semibold underline">{item.loopId}</a><span style={{ color: 'var(--muted)' }}>{relativeTime(item.since)}</span></div>
      <p className="whitespace-pre-wrap">{item.question}</p>
      {readOnly ? <p style={{ color: 'var(--muted)' }}>Read-only demo: answer with <code>loop answer</code> in the loop’s folder{slug && item.file ? <>, or <a className="underline" href={editFileUrl(slug, item.file)} target="_blank" rel="noreferrer">edit {item.file} on GitHub<span className="sr-only"> (opens in a new tab)</span></a></> : null}.</p> : <>
      <label className="block text-[13px]" style={{ color: 'var(--muted)' }}>Your answer (best guess pre-filled)
        <textarea value={answer} onChange={(e) => onAnswer(e.target.value)} rows={3} className="mt-1 w-full rounded border p-2 font-mono" style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" data-action="accept" onClick={() => send.mutate(item.bestGuess)} disabled={send.isPending} className="rounded px-3 py-1.5 font-medium" style={{ background: 'var(--accent)', color: 'var(--bg)' }}>Accept guess (a)</button>
        <button type="button" onClick={() => send.mutate(answer)} disabled={send.isPending || !answer.trim()} className="rounded border px-3 py-1.5" style={{ borderColor: 'var(--border)' }}>Send my answer</button>
        {send.isError && <span role="alert" style={{ color: 'var(--blocked)' }}>{send.error.message}</span>}
      </div></>}
    </li>
  );
}

export function Inbox() {
  const q = useQuery({ queryKey: ['inbox'], queryFn: api.inbox });
  const [sel, setSel] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const loops = useQuery({ queryKey: ['loops'], queryFn: api.loops });
  const server = useQuery({ queryKey: ['server'], queryFn: hasServer });
  const [notice, setNotice] = useState('');
  const items = q.data ?? [];
  const cur = Math.min(sel, items.length - 1);
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.repeat) return;
      if (e.key === 'j') setSel((s) => Math.min(s + 1, items.length - 1));
      else if (e.key === 'k') setSel((s) => Math.max(s - 1, 0));
      else if (e.key === 'a') document.querySelectorAll<HTMLButtonElement>('[data-selected="true"] [data-action="accept"]')[0]?.click();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [items.length]);
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="the inbox" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  // The same list the fleet banner and the nav badge count (A4); items the server inbox does not hold get a plain row.
  const others = attentionItems(loops.data ?? [], items).flatMap((a) => (a.kind === 'inbox' ? [] : [a]));
  if (items.length === 0 && others.length === 0) return <p role="status" style={{ color: 'var(--done)' }}>{notice} Inbox empty: no loop is waiting on you.</p>;
  return (
    <>
    {notice && <p role="status" style={{ color: 'var(--done)' }}>{notice}</p>}
    {others.length > 0 && (
      <ul className="mb-3 space-y-2" aria-label="Loops that need you">
        {others.map((a, i) => (
          <li key={`${a.loopId}/${a.kind}/${i}`} data-testid="attention-row" className="flex flex-wrap justify-between gap-2 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <span>{describeAttention(a, loops.data?.find((l) => l.id === a.loopId))}</span>
            <a href={`#/loop/${encodeURIComponent(a.loopId)}`} className="font-semibold underline">Open {a.loopId}</a>
          </li>
        ))}
      </ul>
    )}
    {items.length > 0 && <ul className="space-y-3" aria-label="Questions">
      {items.map((it, i) => {
        const key = `${it.loopId}/${it.file}`;
        return <Item key={key} item={it} selected={i === cur} answer={drafts[key] ?? it.bestGuess} onAnswer={(v) => setDrafts((d) => ({ ...d, [key]: v }))} onDone={setNotice} readOnly={server.data === false} slug={slugOf(loops.data?.find((l) => l.id === it.loopId)?.repoUrl ?? loops.data?.find((l) => l.id === it.loopId)?.url)} />;
      })}
    </ul>}
    </>
  );
}
