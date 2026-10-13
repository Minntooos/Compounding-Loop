// One way to open the steer composer from anywhere on a loop page: the Steer buttons, a lane row, the `S` key and the command palette.
const EVENT = 'loop:steer';

export function openSteer(lane?: string): void {
  window.dispatchEvent(new CustomEvent<string | undefined>(EVENT, { detail: lane }));
}

/** True when a key press is typing, not a shortcut (inputs, text areas, selects, editable content, open dialogs). */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.closest('dialog[open]') !== null;
}

/** Subscribes to steer requests and the bare `S` key; returns the unsubscribe function. */
export function onSteer(open: (lane?: string) => void): () => void {
  const onEvent = (e: Event) => open((e as CustomEvent<string | undefined>).detail);
  const onKey = (e: KeyboardEvent) => {
    if (e.key.toLowerCase() !== 's' || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
    e.preventDefault();
    open();
  };
  window.addEventListener(EVENT, onEvent);
  window.addEventListener('keydown', onKey);
  return () => { window.removeEventListener(EVENT, onEvent); window.removeEventListener('keydown', onKey); };
}
