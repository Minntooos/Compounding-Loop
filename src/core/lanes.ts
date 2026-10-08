// Lane config: who owns which paths. Pure (no Node imports) so the dashboard can reuse it.

export interface Lane {
  name: string;
  owns: string[];
  cron?: string;
}

export interface LanesConfig {
  lanes: Lane[];
  shared: string[];
}

export interface ParsedLanes {
  config?: LanesConfig;
  errors: string[];
}

/** The supervising routine's commit trailer; it may touch anything. */
export const CONTROL_LANE = 'control';

const LANE_NAME = /^[a-z][a-z0-9-]{0,30}$/;

export function isValidLaneName(name: string): boolean {
  return LANE_NAME.test(name) && name !== CONTROL_LANE;
}

/** Backslashes to slashes, no leading `./` or `/`, so Windows-style paths match POSIX globs. */
export function normalizePath(file: string): string {
  return file.replace(/\\/g, '/').replace(/^(?:\.?\/)+/, '');
}

const REGEX_SPECIAL = /[.+^${}()|[\]\\]/g;

/** Compiles `**` (any depth), `*` (one segment), `?` (one character) and literals to an anchored regex. */
function globToRegExp(glob: string): RegExp {
  const g = normalizePath(glob);
  let out = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i] as string;
    if (c === '*' && g[i + 1] === '*') {
      const slashAfter = g[i + 2] === '/';
      out += slashAfter ? '(?:.*/)?' : '.*';
      i += slashAfter ? 2 : 1;
    } else if (c === '*') out += '[^/]*';
    else if (c === '?') out += '[^/]';
    else out += c.replace(REGEX_SPECIAL, '\\$&');
  }
  return new RegExp(`^${out}$`);
}

export function matchGlob(glob: string, file: string): boolean {
  return globToRegExp(glob).test(normalizePath(file));
}

function matchesAny(globs: readonly string[], file: string): boolean {
  return globs.some((glob) => matchGlob(glob, file));
}

/** A concrete path the glob matches, used to detect two globs claiming the same files. */
function sampleFor(glob: string): string {
  return normalizePath(glob).replace(/\*\*\/?/g, 'x/').replace(/\/$/, '').replace(/[*?]/g, 'x');
}

function globsOverlap(a: string, b: string): boolean {
  return matchGlob(a, sampleFor(b)) || matchGlob(b, sampleFor(a));
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((v) => typeof v === 'string' && v.trim() !== '') ? (value as string[]) : undefined;
}

/** Validates an already-parsed JSON value. Returns every problem found, not just the first. */
export function validateLanesConfig(raw: unknown): ParsedLanes {
  const errors: string[] = [];
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { errors: ['.ai/lanes.json must be an object with "lanes" and "shared".'] };
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.lanes) || obj.lanes.length === 0) return { errors: ['.ai/lanes.json needs at least one lane in "lanes".'] };

  const lanes: Lane[] = [];
  obj.lanes.forEach((item: unknown, index) => {
    const at = `lanes[${index}]`;
    if (typeof item !== 'object' || item === null) return void errors.push(`${at} must be an object.`);
    const entry = item as Record<string, unknown>;
    const name = typeof entry.name === 'string' ? entry.name : '';
    if (!isValidLaneName(name)) errors.push(`${at}: name "${name}" is invalid. Use lowercase letters, digits and dashes, starting with a letter ("${CONTROL_LANE}" is reserved).`);
    else if (lanes.some((l) => l.name === name)) errors.push(`${at}: lane "${name}" is listed twice.`);
    const owns = stringArray(entry.owns);
    if (!owns || owns.length === 0) errors.push(`${at} (${name || '?'}): "owns" must be a non-empty list of globs.`);
    if (entry.cron !== undefined && typeof entry.cron !== 'string') errors.push(`${at} (${name || '?'}): "cron" must be a string.`);
    if (name && owns) lanes.push({ name, owns, ...(typeof entry.cron === 'string' ? { cron: entry.cron } : {}) });
  });

  const shared = obj.shared === undefined ? [] : stringArray(obj.shared);
  if (!shared) errors.push('"shared" must be a list of globs.');

  for (let i = 0; i < lanes.length; i++) {
    for (let j = i + 1; j < lanes.length; j++) {
      for (const a of (lanes[i] as Lane).owns) {
        for (const b of (lanes[j] as Lane).owns) {
          if (globsOverlap(a, b)) errors.push(`Lanes "${(lanes[i] as Lane).name}" and "${(lanes[j] as Lane).name}" both own files matching "${a}" / "${b}". Make the globs disjoint or move the path to "shared".`);
        }
      }
    }
  }
  return errors.length > 0 || !shared ? { errors } : { config: { lanes, shared }, errors };
}

export function parseLanesConfig(text: string): ParsedLanes {
  try {
    return validateLanesConfig(JSON.parse(text));
  } catch {
    return { errors: ['.ai/lanes.json is not valid JSON.'] };
  }
}

/** The lane that owns the file, "shared" for a shared path, or undefined when nobody does. */
export function laneForPath(config: LanesConfig, file: string): string | undefined {
  const lane = config.lanes.find((l) => matchesAny(l.owns, file) || matchGlob(`.ai/lanes/${l.name}/**`, file));
  if (lane) return lane.name;
  return matchesAny(config.shared, file) ? 'shared' : undefined;
}

/** Reads the `Lane: <name>` trailer from a commit message; undefined when there is none. */
export function parseLaneTrailer(message: string): string | undefined {
  const lines = message.trimEnd().split(/\r?\n/);
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = (lines[i] as string).trim();
    if (line === '') break; // trailers live in the last paragraph
    const match = /^lane:\s*(\S+)$/i.exec(line);
    if (match) return (match[1] as string).toLowerCase();
  }
  return undefined;
}

export interface LaneViolation {
  file: string;
  message: string;
}

/** Files a commit with the given `Lane:` trailer may not touch, each with a fix-it message. */
export function checkCommitFiles(config: LanesConfig, lane: string, files: readonly string[]): LaneViolation[] {
  if (lane === CONTROL_LANE) return [];
  const self = config.lanes.find((l) => l.name === lane);
  if (!self) {
    const known = config.lanes.map((l) => l.name).join(', ');
    return [{ file: '(trailer)', message: `unknown lane "${lane}". Use one of: ${known}, or fix the trailer.` }];
  }
  const violations: LaneViolation[] = [];
  for (const file of files) {
    const owner = laneForPath(config, file);
    if (owner === self.name || owner === 'shared') continue;
    const fix = owner
      ? `it belongs to lane "${owner}". Ask that lane through your outbox (.ai/lanes/${self.name}/outbox.md) instead of editing it.`
      : `no lane owns it. Add it to a lane's "owns" or to "shared" in .ai/lanes.json.`;
    violations.push({ file: normalizePath(file), message: `lane "${self.name}" touched ${normalizePath(file)}, but ${fix}` });
  }
  return violations;
}
