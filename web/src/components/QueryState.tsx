import type { ReactNode } from 'react';

export function Loading({ what = 'Loading…' }: { what?: string }) {
  return (
    <p role="status" aria-busy="true" style={{ color: 'var(--muted)' }}>
      {what}
    </p>
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
