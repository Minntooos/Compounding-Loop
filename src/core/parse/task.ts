// Task-file parsing. Pure (no Node imports): the live dashboard runs it in the browser.

export interface RunCounter {
  run: number;
  limit: number;
}

/** Reads the `Run: N / LIMIT` line of a task.md; undefined when the line is missing or malformed. */
export function parseRunCounter(taskText: string): RunCounter | undefined {
  const match = /^Run:\s*(\d+)\s*\/\s*(\d+)\b/m.exec(taskText);
  if (!match) return undefined;
  return { run: Number(match[1]), limit: Number(match[2]) };
}

export interface TaskUnit {
  /** The number in front of the item, e.g. 3 for "3. Phone nav". */
  number: number;
  text: string;
}

export interface ParsedTask {
  run?: RunCounter;
  /** Text after `Status:` on its line, if any. */
  status?: string;
  /** First non-empty line under `## Handoff`, if any. */
  handoffFirstLine?: string;
  /** Numbered items under `## Units, in order`. */
  units: TaskUnit[];
}

/** Body of the `## <heading>` section (up to the next `## `), matched by heading prefix, case-insensitive. Handoffs are appended, so callers wanting the newest ask for `last`. */
export function sectionOf(text: string, heading: string, which: 'first' | 'last' = 'first'): string | undefined {
  const lines = text.split(/\r?\n/);
  const want = heading.toLowerCase();
  const isMatch = (l: string): boolean => /^##\s/.test(l) && l.replace(/^##\s+/, '').trim().toLowerCase().startsWith(want);
  const start = which === 'last' ? lines.map(isMatch).lastIndexOf(true) : lines.findIndex(isMatch);
  if (start < 0) return undefined;
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^##\s/.test(l));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}

export function parseUnits(taskText: string): TaskUnit[] {
  const body = sectionOf(taskText, 'Units');
  if (!body) return [];
  const units: TaskUnit[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = /^(\d+)\.\s+(.+?)\s*$/.exec(line);
    if (match) units.push({ number: Number(match[1]), text: match[2] as string });
  }
  return units;
}

/** Parses the parts of a lane's task.md that status screens need. Missing parts are simply absent. */
export function parseTaskFile(taskText: string): ParsedTask {
  const status = /^Status:[ \t]*(.*)$/m.exec(taskText)?.[1]?.trim();
  const handoff = sectionOf(taskText, 'Handoff', 'last')
    ?.split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l !== '');
  const parsed: ParsedTask = { units: parseUnits(taskText) };
  const run = parseRunCounter(taskText);
  if (run) parsed.run = run;
  if (status) parsed.status = status;
  if (handoff) parsed.handoffFirstLine = handoff;
  return parsed;
}

const NUMBER_LIST = String.raw`\d+(?:\s*[-\u2013]\s*\d+)?(?:\s*(?:,|and|&)\s*\d+(?:\s*[-\u2013]\s*\d+)?)*`;
const DONE_AFTER = /\b(?:shipped|finished|completed|done)\b[:\s]+([^\n]*)/gi;
const UNITS_IN_LINE = new RegExp(String.raw`\bunits?\s+(${NUMBER_LIST})\b(?!\s+(?:partly|partially|not))`, 'gi');
const BARE_LIST = new RegExp(String.raw`^\s*(?:with\s+)?(${NUMBER_LIST})\b(?!\s+(?:partly|partially|not))`, 'i');
const DONE_BEFORE = new RegExp(String.raw`\bunits?\s+(${NUMBER_LIST})\s+(?:are\s+|is\s+|were\s+)?(?:done|shipped|finished|complete[d]?)\b`, 'gi');

function expandNumbers(list: string, into: Set<number>): void {
  for (const part of list.split(/,|and|&/)) {
    const range = /^\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?\s*$/.exec(part);
    if (!range) continue;
    const from = Number(range[1]);
    const to = range[2] === undefined ? from : Number(range[2]);
    for (let n = from; n <= Math.min(to, from + 200); n++) into.add(n);
  }
}

/**
 * Unit numbers a lane says it finished, read from its `Status:` line and newest Handoff, e.g.
 * "units 1-3 done" or "Run 2 shipped units 1, 2 and 4". "unit 5 partly" does not count.
 */
export function doneUnits(taskText: string): Set<number> {
  const status = /^Status:[ \t]*(.*)$/m.exec(taskText)?.[1] ?? '';
  const handoff = sectionOf(taskText, 'Handoff', 'last') ?? '';
  // Only the lines before "Next:" describe finished work; what follows plans it.
  const finished = handoff.split(/\r?\n/).filter((l) => !/^\s*next\b/i.test(l)).join('\n');
  const done = new Set<number>();
  for (const text of [status, finished]) {
    for (const m of text.matchAll(DONE_BEFORE)) expandNumbers(m[1] as string, done);
    for (const m of text.matchAll(DONE_AFTER)) {
      const rest = m[1] as string;
      const named = [...rest.matchAll(UNITS_IN_LINE)];
      for (const u of named) expandNumbers(u[1] as string, done);
      const bare = named.length === 0 ? BARE_LIST.exec(rest) : null;
      if (bare) expandNumbers(bare[1] as string, done);
    }
  }
  return done;
}

/** Units not yet reported done, in file order. */
export function openUnits(taskText: string): TaskUnit[] {
  const done = doneUnits(taskText);
  return parseUnits(taskText).filter((u) => !done.has(u.number));
}
