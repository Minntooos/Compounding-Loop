import { readFile } from 'node:fs/promises';
import type { DemoSnapshot, HealthCheck, InboxItem, LoopDetail, LoopState, LoopSummary } from '../core/types.js';

/** Where the API gets its loops from: the demo snapshot or a projects folder. */
export interface DataSource {
  loops(): Promise<LoopSummary[]>;
  loop(id: string): Promise<LoopDetail | undefined>;
  inbox(): Promise<InboxItem[]>;
  checks(): Promise<HealthCheck[]>;
}

/** Fleet order from the contract: what needs the owner first. */
const ATTENTION_ORDER: readonly LoopState[] = ['failing', 'blocked', 'building', 'waiting', 'done'];

export function sortByAttention<T extends { state: LoopState; name: string }>(loops: readonly T[]): T[] {
  return [...loops].sort(
    (a, b) => ATTENTION_ORDER.indexOf(a.state) - ATTENTION_ORDER.indexOf(b.state) || a.name.localeCompare(b.name),
  );
}

/** The detail-only fields stay out of the fleet list. */
export function toSummary(detail: LoopDetail): LoopSummary {
  const { timeline: _timeline, contract: _contract, knowledge: _knowledge, decisions: _decisions, history: _history, ...summary } = detail;
  return summary;
}

export function snapshotSource(snapshot: DemoSnapshot): DataSource {
  return {
    loops: async () => sortByAttention(snapshot.loops.map(toSummary)),
    loop: async (id) => snapshot.loops.find((l) => l.id === id),
    inbox: async () => snapshot.inbox,
    checks: async () => snapshot.checks,
  };
}

/**
 * Reads the demo snapshot. In the repo it lives in `demo/`; in the published package the build copies it
 * next to the compiled server (`dist/server/five-sites.json`), because `demo/` does not ship.
 */
export async function loadDemoSnapshot(
  candidates: readonly URL[] = [new URL('./five-sites.json', import.meta.url), new URL('../../demo/five-sites.json', import.meta.url)],
): Promise<DemoSnapshot> {
  for (const file of candidates) {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as DemoSnapshot;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error('demo snapshot not found (run `node demo/build-demo.mjs`)');
}
