/** Which edges of a sideways-scrolling row hide more content (A6: a cut label must come with a fade that says "scroll"). 1 px slack for subpixel widths. */
export function fadeEdges(scrollLeft: number, clientWidth: number, scrollWidth: number): { start: boolean; end: boolean } {
  return { start: scrollLeft > 1, end: scrollLeft + clientWidth < scrollWidth - 1 };
}

/** CSS mask for those edges: 24 px fade on each side that has more content, none when everything fits. */
export function fadeMask(edges: { start: boolean; end: boolean }): string | undefined {
  if (!edges.start && !edges.end) return undefined;
  return `linear-gradient(to right, ${edges.start ? 'transparent 0, #000 24px' : '#000 0'}, ${edges.end ? '#000 calc(100% - 24px), transparent 100%' : '#000 100%'})`;
}
