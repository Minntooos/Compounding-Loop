export interface Toast { id: number; text: string }

/** Polite live region for server events; each toast is dismissed by the caller after a few seconds. */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => (
        <p key={t.id} data-testid="toast" className="rounded-lg border px-3 py-2 text-[13px] shadow-lg" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>{t.text}</p>
      ))}
    </div>
  );
}

const EVENT = 'cl-toast';

/** Show a toast from anywhere without threading a callback through the tree; App listens and renders it. */
export function toast(text: string): void {
  window.dispatchEvent(new CustomEvent<string>(EVENT, { detail: text }));
}

/** Subscribe to `toast()` calls; returns the unsubscribe function. */
export function onToast(fn: (text: string) => void): () => void {
  const handler = (e: Event) => { if (e instanceof CustomEvent && typeof e.detail === 'string') fn(e.detail); };
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
