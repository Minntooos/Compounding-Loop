import { laneColor } from '../lib/timeline';
import { useScrollFade } from './useScrollFade';

/**
 * Lane filter chips (Timeline and Runs). At 375 px five lanes overflow the row, so it scrolls sideways inside itself and
 * fades the edge that hides chips, like the tab rows (A6). Lane names come from repo files: text nodes only.
 */
export function LaneFilter({ label, lanes, active, onAll, onToggle }: { label: string; lanes: string[]; active: ReadonlySet<string>; onAll: () => void; onToggle: (lane: string) => void }) {
  const fade = useScrollFade<HTMLDivElement>(lanes.join(','));
  const chip = 'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] min-h-11 sm:min-h-8 aria-pressed:font-semibold aria-pressed:underline';
  return (
    <div ref={fade.ref} onScroll={fade.onScroll} onFocus={fade.onFocus} role="group" aria-label={label} className="flex gap-1.5 overflow-x-auto pb-1" style={fade.style}>
      <button type="button" aria-pressed={active.size === 0} onClick={onAll} className={chip} style={{ borderColor: 'var(--border)' }}>All</button>
      {lanes.map((l) => (
        <button key={l} type="button" aria-pressed={active.has(l)} onClick={() => onToggle(l)} className={chip} style={{ borderColor: 'var(--border)' }}>
          <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: laneColor(l) }} />{l}
        </button>
      ))}
    </div>
  );
}
