import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { fadeEdges, fadeMask } from '../lib/scrollFade';

const EDGE = 24;

/**
 * For a sideways-scrolling tab row: fades the edges that hide more tabs and keeps the active tab (`[aria-current="page"]` or
 * `[aria-selected="true"]`) in view. `key` changes when the active tab does. Tabs can grow after data arrives (the Inbox
 * badge), so a ResizeObserver repeats both.
 */
export function useScrollFade<T extends HTMLElement>(key: unknown): { ref: React.RefObject<T | null>; style: CSSProperties; onScroll: () => void } {
  const ref = useRef<T | null>(null);
  const [mask, setMask] = useState<string | undefined>();
  const measure = useCallback(() => {
    const el = ref.current;
    if (el) setMask(fadeMask(fadeEdges(el.scrollLeft, el.clientWidth, el.scrollWidth)));
  }, []);
  const reveal = useCallback(() => {
    const el = ref.current;
    const active = el?.querySelector<HTMLElement>('[aria-current="page"], [aria-selected="true"]');
    // Scroll only the row, never the page: scrollIntoView would also move the window vertically.
    if (el && active && el.scrollWidth > el.clientWidth) {
      const row = el.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      const left = box.left - row.left + el.scrollLeft;
      if (left - EDGE < el.scrollLeft) el.scrollLeft = Math.max(0, left - EDGE);
      else if (left + box.width + EDGE > el.scrollLeft + el.clientWidth) el.scrollLeft = left + box.width + EDGE - el.clientWidth;
    }
    measure();
  }, [measure]);
  useEffect(reveal, [key, reveal]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(reveal);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    return () => ro.disconnect();
  }, [key, reveal]);
  return { ref, style: mask ? { maskImage: mask, WebkitMaskImage: mask } : {}, onScroll: measure };
}
