import { readFile } from 'node:fs/promises';
import { EVAL_COMMAND } from './memory.js';
import { withLabel } from './checkLabels.js';
import type { DemoSnapshot, EvalReportData, HealthCheck, KnowledgeReport, RecipesReport, InboxItem, LoopDetail, LoopState, LoopSummary } from '../core/types.js';

/** Where the API gets its loops from: the demo snapshot or a projects folder. */
export interface DataSource {
  loops(): Promise<LoopSummary[]>;
  loop(id: string): Promise<LoopDetail | undefined>;
  inbox(): Promise<InboxItem[]>;
  checks(): Promise<HealthCheck[]>;
  /** Absent for read-only sources (the demo). Resolves with the new commit's sha. */
  answer?(id: string, answer: string): Promise<{ commit: string; pushed: boolean } | undefined>;
  /** Absent for read-only sources. Each resolves undefined for an unknown loop. */
  control?: LoopControls;
  /** The `loop doctor` report of this machine; absent for the demo. */
  doctor?(): Promise<{ report: string; passed: boolean }>;
  /** Round 6: a loop's index entries, triggers and matching recipes; undefined for an unknown loop. */
  knowledge?(id: string): Promise<KnowledgeReport | undefined>;
  /** Round 6: project and user recipe stores. */
  recipes?(): Promise<RecipesReport>;
  /** Round 6: the latest eval report; no results is an empty report, not an error. */
  evalReport?(): Promise<EvalReportData>;
}

export interface ControlResult {
  changed: boolean;
  pushed?: boolean;
  pushError?: string;
}

/** The dashboard's pause, resume and next-round buttons for a local loop clone. */
export interface LoopControls {
  pause(id: string, reason?: string): Promise<(ControlResult & { by?: string }) | undefined>;
  resume(id: string): Promise<ControlResult | undefined>;
  nextRound(id: string, brief: string): Promise<(ControlResult & { committed: boolean }) | undefined>;
  /** Adds a steer entry for a lane (and wakes it); `lanes` lists the lanes whose files changed. */
  steer(id: string, lane: string, text: string, options?: { standing?: boolean; author?: string }): Promise<(ControlResult & { lanes: string[] }) | undefined>;
  /** Pause, resume, snooze or wake one lane (`all` for wake) in `.ai/schedule.json`. */
  schedule(id: string, action: LaneScheduleAction): Promise<(ControlResult & { lanes: string[] }) | undefined>;
  /** Sets the loop's pace, or one lane's, in `.ai/policy.json`. */
  pace(id: string, pace: string, lane?: string): Promise<(ControlResult & { lanes: string[] }) | undefined>;
  /** Drafts the next round's brief with `claude -p` (read-only tools), reporting steps as it goes. Aborting `signal` stops the `claude` process. Writes nothing: the owner reviews the draft, then sends it to `nextRound`. */
  draftBrief(id: string, options: { model?: string }, onProgress: (step: string) => void, signal?: AbortSignal): Promise<BriefDraft | undefined>;
}

import type { BriefGap } from '../core/brief.js';

export interface BriefDraft {
  draft: string;
  /** `lintBrief` score, 0-100. */
  score: number;
  gaps: BriefGap[];
}

/** The owner actions on `.ai/schedule.json`; `until` is an ISO time, a date or a span such as `3h`. */
export type LaneScheduleAction =
  | { action: 'pause'; lane: string; reason?: string }
  | { action: 'resume'; lane: string }
  | { action: 'snooze'; lane: string; until: string; reason?: string }
  | { action: 'wake'; lane: string };

/** Fleet order from the contract: what needs the owner first. */
const ATTENTION_ORDER: readonly LoopState[] = ['failing', 'blocked', 'building', 'waiting', 'done'];

export function sortByAttention<T extends { state: LoopState; name: string }>(loops: readonly T[]): T[] {
  return [...loops].sort(
    (a, b) => ATTENTION_ORDER.indexOf(a.state) - ATTENTION_ORDER.indexOf(b.state) || a.name.localeCompare(b.name),
  );
}

/** The detail-only fields stay out of the fleet list. */
export function toSummary(detail: LoopDetail): LoopSummary {
  const { controlNotes: _controlNotes, releases: _releases, ship: _ship, runs: _runs, nextRuns: _nextRuns, schedule: _schedule, pace: _pace, idleRuns: _idleRuns, steer: _steer, laneNotes: _laneNotes, timeline: _timeline, contract: _contract, knowledge: _knowledge, decisions: _decisions, history: _history, ...summary } = detail;
  return summary;
}

/** Marks every loop of a bundled snapshot with when it was taken, so the UI says "snapshot 6 Oct" and never "Live". */
export function stampSnapshot(snapshot: DemoSnapshot): DemoSnapshot {
  return { ...snapshot, loops: snapshot.loops.map((loop) => ({ ...loop, snapshotAt: loop.snapshotAt ?? snapshot.generatedAt })) };
}

export function snapshotSource(snapshot: DemoSnapshot): DataSource {
  const checks = snapshot.checks.map(withLabel);
  return {
    loops: async () => sortByAttention(snapshot.loops.map(toSummary)),
    loop: async (id) => snapshot.loops.find((l) => l.id === id),
    inbox: async () => snapshot.inbox,
    checks: async () => checks,
    knowledge: async (id) => (snapshot.loops.some((l) => l.id === id) ? (snapshot.knowledge?.[id] ?? { entries: [], triggers: [], recipes: [] }) : undefined),
    recipes: async () => snapshot.recipes ?? { recipes: [] },
    evalReport: async () => snapshot.eval ?? { rows: [], sample: false, command: EVAL_COMMAND },
  };
}

async function readFirst<T>(candidates: readonly URL[]): Promise<T | undefined> {
  for (const file of candidates) {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as T;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return undefined;
}

/**
 * Appends the sixth loop (this repo building itself) after the five sites. Its checks are left out for now:
 * web's health e2e asserts exactly the five sites' 10 checks (see outbox).
 */
export function withSelfLoop(snapshot: DemoSnapshot, self: { loop: LoopDetail }): DemoSnapshot {
  return { ...snapshot, loops: [...snapshot.loops, self.loop] };
}

/**
 * Reads the demo snapshot: the five sites plus, when present, the sixth loop (this repo). In the repo they live
 * in `demo/`; in the published package the build copies them next to the compiled server, because `demo/` does not ship.
 */
export async function loadDemoSnapshot(
  candidates: readonly URL[] = [new URL('./five-sites.json', import.meta.url), new URL('../../demo/five-sites.json', import.meta.url)],
  selfCandidates: readonly URL[] = [new URL('./this-repo.json', import.meta.url), new URL('../../demo/this-repo.json', import.meta.url)],
  memoryCandidates: readonly URL[] = [new URL('./memory.json', import.meta.url), new URL('../../demo/memory.json', import.meta.url)],
): Promise<DemoSnapshot> {
  const snapshot = await readFirst<DemoSnapshot>(candidates);
  if (!snapshot) throw new Error('demo snapshot not found (run `node demo/build-demo.mjs`)');
  const self = await readFirst<{ loop: LoopDetail; checks: HealthCheck[] }>(selfCandidates);
  const memory = await readFirst<Pick<DemoSnapshot, 'knowledge' | 'recipes' | 'eval'>>(memoryCandidates);
  return stampSnapshot({ ...(self ? withSelfLoop(snapshot, self) : snapshot), ...memory });
}
