import type { ReactNode } from 'react';

/** Placeholder blocks in roughly the final layout, so the page does not jump; static under reduced motion (index.css). */
export function Loading({ what = 'Loading…' }: { what?: string }) {
  return (
    <div aria-busy="true">
      <p role="status" style={{ color: 'var(--muted)' }}>{what}</p>
      <div aria-hidden className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-lg border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }} />)}
      </div>
    </div>
  );
}

export function LoadError({ what, onRetry, busy = false }: { what: string; onRetry: () => void; busy?: boolean }): ReactNode {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3" style={{ color: 'var(--failing)' }}>
      <span>Could not load {what}.</span>
      <button type="button" onClick={onRetry} disabled={busy} className="rounded-md border px-3 py-1" style={{ borderColor: 'var(--failing)' }}>
        {busy ? 'Retrying…' : 'Try again'}
      </button>
    </div>
  );
}

const NOTICE_TONE = { calm: 'var(--muted)', warn: 'var(--blocked)' } as const;

/** A quiet in-page note (not an alert): states that are expected, like a paused live view, are never styled as errors. */
export function Notice({ tone = 'calm', children }: { tone?: keyof typeof NOTICE_TONE; children: ReactNode }) {
  return (
    <div role="note" className="mb-4 rounded-lg border px-4 py-2 text-[13px]" style={{ borderColor: 'var(--border)', background: 'var(--surface)', borderLeft: `3px solid ${NOTICE_TONE[tone]}` }}>
      {children}
    </div>
  );
}
