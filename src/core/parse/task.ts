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
