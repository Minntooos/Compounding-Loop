// Starting the next round of a laned repo (IDEA.md Round 4 B3). Pure: takes file texts, returns the changes to make.
import { lintBrief, type BriefLint } from './brief.js';
import type { Lane } from './lanes.js';
import { nextDoneFileName } from './rounds.js';
import { parseRunCounter } from './parse/task.js';
import { fillPlaceholders } from './template.js';

const ROUND_HEADING = /^##\s+Round\s+(\d+)\b/;
const DEFAULT_RUN_LIMIT = 20;

/** The number of the round being started: one above the highest `## Round N` heading in IDEA.md. */
export function nextRoundNumber(ideaText: string): number {
  const numbers = ideaText.split(/\r?\n/).flatMap((line) => {
    const match = ROUND_HEADING.exec(line);
    return match ? [Number(match[1])] : [];
  });
  return Math.max(0, ...numbers) + 1;
}

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

/** Puts `brief` first in IDEA.md and turns the previous "(current)" heading into "(finished <date>)". */
export function insertBrief(ideaText: string, brief: string, round: number, now: Date): string {
  // A brief that ends with its own rule would double up with the one we add before the older rounds.
  const body = brief.trim().replace(/(?:\r?\n\s*-{3,}\s*)+$/, '');
  const section = /^##\s/.test(body) ? body : `## Round ${round} (current) — started ${utcDay(now)} ${now.toISOString().slice(11, 16)} UTC\n\n${body}`;
  const lines = ideaText.split(/\r?\n/).map((line) => (ROUND_HEADING.test(line) ? line.replace(/\(current\)/i, `(finished ${utcDay(now)})`) : line));
  const firstRound = lines.findIndex((line) => ROUND_HEADING.test(line));
  const at = firstRound !== -1 ? firstRound : Math.min(lines.length, lines.findIndex((l) => /^#\s/.test(l)) + 1);
  const before = lines.slice(0, at).join('\n').trimEnd();
  const after = lines.slice(at).join('\n').trimStart();
  return `${before ? `${before}\n\n` : ''}${section}\n\n---\n\n${after}`.trimEnd() + '\n';
}

/**
 * A control-room note, newest first: before the first dated note that follows the `# ` title (so stray dated lines above
 * the title do not pull it to the middle of the file), or at the end when there is none.
 */
export function addControlNote(controlText: string, note: string): string {
  const lines = controlText.split(/\r?\n/);
  const isNote = (l: string) => /^\d{4}-\d\d-\d\d \d\d:\d\d UTC · /.test(l);
  const title = lines.findIndex((l) => /^#\s/.test(l));
  const from = title === -1 ? 0 : title + 1;
  const at = lines.findIndex((l, i) => i >= from && isNote(l));
  if (at === -1) return `${controlText.trimEnd()}\n\n${note}\n`;
  return [...lines.slice(0, at), note, ...lines.slice(at)].join('\n');
}

const PLACEHOLDER_LINE = /^\s*<[^>\n]+>\s*$/;

/** Replaces the `<placeholders>` of the lane task template so a fresh task.md has no unfilled field. */
export function fillTaskPlaceholders(task: string, round: number): string {
  const brief = `the Round ${round} brief (IDEA.md, first section)`;
  return task
    .replace(/^(\*\*Goal:\*\*)\s*<[^>\n]+>\s*$/m, `$1 this lane's part of ${brief}.`)
    .replace(/^(\*\*Out of scope:\*\*)\s*<[^>\n]+>\s*$/m, '$1 paths another lane owns (see `.ai/lanes.json`).')
    .replace(/^(\s*-\s)<[^>\n]+>\s*$/m, `$1every item ${brief} assigns to this lane passes its test.`)
    .replace(/^(\d+\.\s)<first real unit>\s*$/m, `$1The first item ${brief} assigns to this lane.`)
    .replace(/^<Rewritten at the end of every run[^\n]*>\s*$/m, `Not started. Read ${brief}, then begin with the audit.`)
    .split('\n')
    .filter((line) => !PLACEHOLDER_LINE.test(line))
    .join('\n');
}

export type RoundChange = { kind: 'write'; path: string; content: string } | { kind: 'move'; from: string; to: string } | { kind: 'delete'; path: string };

export interface RoundInput {
  brief: string;
  now: Date;
  ideaText: string;
  controlRoomText?: string;
  lanes: readonly Lane[];
  /** Repo-relative paths (forward slashes) of the root files and everything under `.ai/`. */
  files: readonly string[];
  /** Each lane's current task.md text, keyed by lane name. */
  laneTasks: Readonly<Record<string, string | undefined>>;
  taskTemplate: string;
  /** Repo-relative path of the brief when it lives in the repo; it is deleted once consumed. */
  briefPath?: string;
}

export interface RoundPlan {
  round: number;
  brief: BriefLint;
  changes: RoundChange[];
  /** Lanes whose BLOCKED.md still stands: they stay stopped after the reset. */
  blockedLanes: string[];
}

const filesIn = (files: readonly string[], dir: string) => files.flatMap((f) => (f.startsWith(`${dir}/`) && !f.slice(dir.length + 1).includes('/') ? [f.slice(dir.length + 1)] : []));

/** Everything `loop next-round --brief` does, as a list of changes. Nothing here touches the disk. */
export function planLaneRound(input: RoundInput): RoundPlan {
  const { now, lanes, files } = input;
  const round = nextRoundNumber(input.ideaText);
  const changes: RoundChange[] = [{ kind: 'write', path: 'IDEA.md', content: insertBrief(input.ideaText, input.brief, round, now) }];

  if (files.includes('DONE.md')) changes.push({ kind: 'move', from: 'DONE.md', to: `.ai/${nextDoneFileName(filesIn(files, '.ai'))}` });
  const blockedLanes: string[] = [];
  for (const lane of lanes) {
    const dir = `.ai/lanes/${lane.name}`;
    const own = filesIn(files, dir);
    if (own.includes('DONE.md')) changes.push({ kind: 'move', from: `${dir}/DONE.md`, to: `${dir}/${nextDoneFileName(own)}` });
    if (own.includes('BLOCKED.md')) blockedLanes.push(lane.name);
    const limit = parseRunCounter(input.laneTasks[lane.name] ?? '')?.limit ?? DEFAULT_RUN_LIMIT;
    const task = fillTaskPlaceholders(fillPlaceholders(input.taskTemplate, { lane: lane.name, owns: lane.owns.join(', ') }), round).replace(/^Run:\s*\d+\s*\/\s*\d+/m, `Run: 0 / ${limit}`);
    changes.push({ kind: 'write', path: `${dir}/task.md`, content: task });
  }
  const stamp = `${utcDay(now)} ${now.toISOString().slice(11, 16)} UTC`;
  const note = `${stamp} · to all · Round ${round} has started; the brief is the first section of IDEA.md. Previous DONE files are archived as done-vN.md. First unit for every lane: a Round ${round} section in your audit. Run budgets are reset. (loop next-round)`;
  changes.push({ kind: 'write', path: '.ai/control-room.md', content: addControlNote(input.controlRoomText ?? '# Control room notes\n', note) });
  if (input.briefPath) changes.push({ kind: 'delete', path: input.briefPath });
  return { round, brief: lintBrief(input.brief), changes, blockedLanes };
}
