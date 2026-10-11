import type { ContractItem, LaneNotes } from '@core/types';
import { Check, X } from 'lucide-react';

export type NotesKind = 'contract' | 'decisions' | 'knowledge';

const EMPTY: Record<NotesKind, string> = {
  contract: 'No contract lines for this lane yet.',
  decisions: 'No decisions recorded for this lane.',
  knowledge: 'No knowledge entries for this lane yet.',
};

// Entries are plain text from repo files: rendered as text nodes only, never as HTML.
function ContractList({ items }: { items: ContractItem[] }) {
  return (
    <ul className="space-y-2">
      {items.map((c, i) => (
        <li key={i} className="flex items-start gap-2" style={{ color: c.pass ? 'var(--done)' : 'var(--failing)' }}>
          {c.pass ? <Check aria-label="Passes" size={16} /> : <X aria-label="Fails" size={16} />}<span style={{ color: 'var(--text)' }}>{c.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Entries({ items }: { items: string[] }) {
  return <ul className="space-y-2">{items.map((t, i) => <li key={i} className="whitespace-pre-wrap rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>{t}</li>)}</ul>;
}

/** One section per lane, each with its own empty state, so a quiet lane doesn't vanish. */
export function LaneNotesView({ notes, kind }: { notes: LaneNotes[]; kind: NotesKind }) {
  return (
    <div className="space-y-5">
      {notes.map((n) => (
        <section key={n.lane} data-testid="lane-notes" aria-labelledby={`notes-${kind}-${n.lane}`}>
          <h3 id={`notes-${kind}-${n.lane}`} className="mb-2 break-all font-mono text-[14px] font-semibold">{n.lane}</h3>
          {n[kind].length === 0
            ? <p style={{ color: 'var(--muted)' }}>{EMPTY[kind]}</p>
            : kind === 'contract' ? <ContractList items={n.contract} /> : <Entries items={n[kind]} />}
        </section>
      ))}
    </div>
  );
}
