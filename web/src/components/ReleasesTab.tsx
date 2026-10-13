import { Check, Minus, X } from 'lucide-react';
import type { LoopRelease } from '@core/types';
import { releaseChips, type ChipTone } from '../lib/releases';

const TONE: Record<ChipTone, { icon: typeof Check; color: string }> = {
  ok: { icon: Check, color: 'var(--done)' }, off: { icon: X, color: 'var(--muted)' }, unknown: { icon: Minus, color: 'var(--muted)' },
};

// CHANGELOG text is repo content: rendered as text nodes only.
export function ReleasesTab({ releases }: { releases: LoopRelease[] }) {
  if (releases.length === 0) return <p style={{ color: 'var(--muted)' }}>No CHANGELOG found. Releases appear here when the repo has a CHANGELOG.md.</p>;
  return (
    <ul className="space-y-2" aria-label="Releases">
      {releases.map((r) => (
        <li key={r.version} data-testid="release-row" className="rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <details>
            <summary className="flex min-h-11 cursor-pointer flex-wrap items-baseline gap-x-3 px-3 py-2">
              <span className="font-mono font-semibold">{r.version}</span>
              <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{r.date ?? 'Unreleased'} · {r.items.length} {r.items.length === 1 ? 'entry' : 'entries'}</span>
              {releaseChips(r).map((c) => {
                const { icon: Icon, color } = TONE[c.tone];
                return <span key={c.label} data-testid="release-chip" className="inline-flex items-center gap-1 rounded-full border px-2 text-[12px]" style={{ borderColor: 'var(--border)', color }}><Icon aria-hidden size={12} />{c.label}</span>;
              })}
            </summary>
            <div className="space-y-3 px-3 pb-3">
              {r.sections.map((s) => (
                <section key={s.title} aria-label={s.title}>
                  <h4 className="text-[13px] font-semibold">{s.title}</h4>
                  <ul className="list-disc space-y-1 pl-5 [overflow-wrap:anywhere]">{s.items.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </section>
              ))}
            </div>
          </details>
        </li>
      ))}
    </ul>
  );
}
