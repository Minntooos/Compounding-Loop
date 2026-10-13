import { AlertTriangle, CircleHelp, OctagonAlert, Tag, type LucideIcon } from 'lucide-react';
import type { NeedsYouRow, RowGroup } from '../lib/needsYou';

const ICON: Record<RowGroup, LucideIcon> = { question: CircleHelp, failing: OctagonAlert, stalled: AlertTriangle, release: Tag };
const COLOR: Record<RowGroup, string> = { question: 'var(--blocked)', failing: 'var(--failing)', stalled: 'var(--blocked)', release: 'var(--blocked)' };

/** Needs-you rows (DESIGN.md §12 C2): icon, one sentence, the loop, and the action inline; the action wraps under the text on a phone. */
export function NeedsYouList({ rows, label }: { rows: NeedsYouRow[]; label: string }) {
  return (
    <ul className="space-y-2" aria-label={label}>
      {rows.map((r) => {
        const Icon = ICON[r.group];
        return (
          <li key={r.key} data-testid="attention-row" data-group={r.group} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border p-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex min-w-0 flex-1 basis-64 items-start gap-2">
              <Icon aria-hidden size={18} className="mt-0.5 shrink-0" style={{ color: COLOR[r.group] }} />
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <p>{r.text}</p>
                <p className="text-[13px]" style={{ color: 'var(--muted)' }}><a href={`#/loop/${encodeURIComponent(r.loopId)}`} className="underline">{r.loopName}</a></p>
                {r.explain && (
                  <details className="mt-1 text-[13px]">
                    <summary className="cursor-pointer" style={{ color: 'var(--accent)' }}>What this means</summary>
                    <p className="mt-1" style={{ color: 'var(--muted)' }}>{r.explain}</p>
                  </details>
                )}
              </div>
            </div>
            <a href={r.action.href} {...(r.action.external && { target: '_blank', rel: 'noopener noreferrer' })}
              className="inline-flex min-h-11 items-center rounded border px-3 font-medium md:min-h-9" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              {r.action.label}{r.action.external && <span className="sr-only"> (opens in a new tab)</span>}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
