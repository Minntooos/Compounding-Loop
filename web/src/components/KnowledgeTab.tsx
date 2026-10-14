import { useQuery } from '@tanstack/react-query';
import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KnowledgeEntryInfo, KnowledgeReport, LaneNotes, RecipeSummary, TriggerInfo } from '@core/types';
import { api } from '../api/client';
import { capPercent, firedText, looseTriggers, recipeContextCommand, trackRecord, triggersOf } from '../lib/knowledge';
import { EvalView } from './EvalView';
import { LaneNotesView } from './LaneNotesView';
import { LoadError, Loading } from './QueryState';
import { copyText } from './WelcomeStrip';

const card = { background: 'var(--surface)', borderColor: 'var(--border)' } as const;

function Chip({ children }: { children: string }) {
  return <span className="break-all rounded border px-1.5 py-0.5 font-mono text-[12px]" style={{ borderColor: 'var(--border)' }}>{children}</span>;
}

// Entries and ids are repo text: text nodes only, never HTML.
function TriggerBadge({ t }: { t: TriggerInfo }) {
  return (
    <li data-testid="trigger-badge" className="inline-flex flex-wrap items-center gap-1.5 text-[13px]">
      <Chip>{t.id}</Chip>
      <span style={{ color: 'var(--muted)' }}>{t.kinds.length ? `on ${t.kinds.join(', ')} · ` : ''}{firedText(t.fired)}</span>
    </li>
  );
}

function EntryCard({ e, triggers }: { e: KnowledgeEntryInfo; triggers: TriggerInfo[] }) {
  const mine = triggersOf(e, triggers);
  return (
    <li data-testid="knowledge-entry" className="space-y-2 rounded-lg border p-3" style={card}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="break-all font-mono text-[13px] font-semibold">{e.id}</span>
        <span data-testid="entry-status" className="text-[12px] font-medium" style={{ color: e.status === 'confirmed' ? 'var(--done)' : 'var(--muted)' }}>{e.status === 'confirmed' ? 'Confirmed' : 'Guess'}</span>
      </div>
      <p className="break-words">{e.title}</p>
      {mine.length === 0
        ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No trigger injects this entry yet.</p>
        : <ul className="flex flex-col gap-1">{mine.map((t) => <TriggerBadge key={t.id} t={t} />)}</ul>}
    </li>
  );
}

function CopyContext({ id }: { id: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle');
  const shown = useRef<HTMLElement>(null);
  const command = recipeContextCommand(id);
  async function copy() { setState((await copyText(command, shown.current)) ? 'copied' : 'selected'); }
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <code ref={shown} className="break-all rounded px-1.5 py-0.5 font-mono text-[12px]" style={{ background: 'var(--bg)' }}>{command}</code>
        <button type="button" onClick={() => void copy()} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border px-3 text-[13px] sm:min-h-0 sm:py-1" style={{ borderColor: 'var(--border)' }}>
          {state === 'copied' ? <Check aria-hidden size={14} /> : <Copy aria-hidden size={14} />}{state === 'copied' ? 'Copied' : 'Copy context command'}<span className="sr-only"> for {id}</span>
        </button>
      </div>
      <p role="status" className="text-[12px]" style={{ color: 'var(--muted)' }}>{state === 'selected' ? 'Clipboard blocked: the command is selected, press Ctrl+C.' : ''}</p>
    </div>
  );
}

function RecipeCard({ r }: { r: RecipeSummary }) {
  const pct = capPercent(r.bytes);
  return (
    <li data-testid="recipe-card" className="space-y-2 rounded-lg border p-3" style={card}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="break-all font-mono text-[13px] font-semibold">{r.id}</span>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{r.kind === 'project' ? 'Whole project' : 'Feature'} · {r.store === 'project' ? 'this repo' : 'your store'}</span>
        <span className="text-[12px] font-medium" style={{ color: r.status === 'CONFIRMED' ? 'var(--done)' : 'var(--muted)' }}>{r.status === 'CONFIRMED' ? 'Confirmed' : 'Guess'}</span>
      </div>
      <p className="break-words font-medium">{r.title}</p>
      {r.match && <p data-testid="recipe-match" className="text-[13px]" style={{ color: 'var(--muted)' }}>Fit: {r.match.reason}</p>}
      <ul aria-label="Stack and tags" className="flex flex-wrap gap-1.5">{[...r.stack, ...r.tags].map((c) => <li key={c}><Chip>{c}</Chip></li>)}</ul>
      <p className="text-[13px]">{r.steps} steps · {r.checks} checks · {trackRecord(r)}</p>
      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--muted)' }}>
        <div role="progressbar" aria-label={`${r.id} size`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-1.5 w-28 overflow-hidden rounded" style={{ background: 'var(--border)' }}>
          <div className="h-full" style={{ width: `${pct}%`, background: pct > 90 ? 'var(--blocked)' : 'var(--accent)' }} />
        </div>
        <span>{r.bytes} of 6144 bytes</span>
      </div>
      <CopyContext id={r.id} />
    </li>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return <section aria-labelledby={id} className="space-y-3"><h3 id={id} className="text-[15px] font-semibold">{title}</h3>{children}</section>;
}

function Memory({ report }: { report: KnowledgeReport }) {
  const loose = looseTriggers(report.triggers, report.entries);
  return (
    <>
      <Section id="kn-entries" title="Index entries">
        {report.entries.length === 0
          ? <p style={{ color: 'var(--muted)' }}>No knowledge entries yet. A loop writes one the moment it learns something; add a trigger in <code>.ai/triggers.yaml</code> to inject it when it matters.</p>
          : <ul className="grid gap-3 md:grid-cols-2">{report.entries.map((e) => <EntryCard key={e.id} e={e} triggers={report.triggers} />)}</ul>}
        {loose.length > 0 && (
          <div className="space-y-1"><p className="text-[13px]" style={{ color: 'var(--muted)' }}>Triggers with no index entry</p><ul className="flex flex-col gap-1">{loose.map((t) => <TriggerBadge key={t.id} t={t} />)}</ul></div>
        )}
      </Section>
      <Section id="kn-recipes" title="Recipes that fit this loop">
        {report.recipes.length === 0
          ? <p style={{ color: 'var(--muted)' }}>No recipe fits yet. Recipes are written when a loop finishes a task cleanly: run <code>loop recipe</code> to list the ones you have.</p>
          : <ul className="grid gap-3 md:grid-cols-2">{report.recipes.map((r) => <RecipeCard key={r.id} r={r} />)}</ul>}
      </Section>
    </>
  );
}

/** Knowledge & recipes (Round 6): index entries with trigger badges, fitting recipes, the eval, and the lane notes the tab showed before. */
export function KnowledgeTab({ loopId, laneNotes, notes = [] }: { loopId: string; laneNotes?: LaneNotes[]; notes?: string[] }) {
  const q = useQuery({ queryKey: ['knowledge', loopId], queryFn: () => api.knowledge(loopId) });
  if (q.isPending) return <Loading />;
  if (q.isError) return <LoadError what="the knowledge" onRetry={() => void q.refetch()} busy={q.isFetching} />;
  return (
    <div className="space-y-6">
      <h2 className="sr-only">Knowledge &amp; recipes</h2>
      <Memory report={q.data} />
      <EvalView />
      {!laneNotes?.length && notes.length > 0 && (
        <Section id="kn-notes" title="Notes"><ul className="space-y-2">{notes.map((t, i) => <li key={i} className="whitespace-pre-wrap rounded-lg border p-3" style={card}>{t}</li>)}</ul></Section>
      )}
      {laneNotes && laneNotes.length > 0 && <Section id="kn-lanes" title="Lane notes"><LaneNotesView notes={laneNotes} kind="knowledge" /></Section>}
    </div>
  );
}
