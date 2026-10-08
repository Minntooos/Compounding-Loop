// Planning for `loop init --lanes` and `loop lanes add`: decides what to write, without touching the disk.
import { fillPlaceholders } from './template.js';
import type { InitAction } from './init.js';
import { isValidLaneName, validateLanesConfig, type Lane, type LanesConfig } from './lanes.js';

export const LANES_START = '<!-- compounding-loop:lanes:start -->';
export const LANES_END = '<!-- compounding-loop:lanes:end -->';

/** Shared files every new laned repo starts with; the user edits `.ai/lanes.json` to taste. */
export const DEFAULT_SHARED = ['package.json', 'package-lock.json', '.gitignore', '.ai/audit/**'];

export interface LaneTemplates {
  task: string;
  outbox: string;
  controlRoom: string;
  /** The lane section merged into CLAUDE.md between markers. */
  claudeSection: string;
}

// Used when the package has no templates/lanes/ files, so init never fails on a half-installed kit.
export const FALLBACK_LANE_TEMPLATES: LaneTemplates = {
  task: `# Lane: {{lane}}

Run: 0 / 20
Status: not started

## Contract
**Goal:**
**Done when:**
**Constraints:** edit only the paths this lane owns in \`.ai/lanes.json\`: {{owns}}
**Out of scope:**

## Units, in order
1.

## Decisions

## Confirmed

## Guesses

## Tried

## Handoff
`,
  outbox: `# Outbox: {{lane}}

Newest first. Format: \`YYYY-MM-DD HH:MM UTC · to <lane|all> · message\`.
`,
  controlRoom: `# Control room notes

Written only by the control room routine. Every lane reads it at the start of a run. Newest first. Format: \`YYYY-MM-DD HH:MM UTC · to <lane|all> · message\`.
`,
  claudeSection: `## Lanes

Lanes in this repo: {{lanes}}. \`.ai/lanes.json\` says who owns which paths; read it first. Edit only your lane's paths (and the shared ones). Every commit ends with a trailer line \`Lane: <your lane>\`; \`loop check-lanes\` fails a commit that crosses lanes.

Talk to other lanes by writing to your own \`.ai/lanes/<you>/outbox.md\` (newest first). At the start of each run read every other lane's outbox and \`.ai/control-room.md\`. Your task file is \`.ai/lanes/<you>/task.md\`.
`,
};

/** Staggered hourly cron minutes (7, 19, 31, 43, 55, ...) so lanes never start together. */
export function staggeredCron(index: number): string {
  return `${(7 + 12 * index) % 60} * * * *`;
}

/** Parses `a,b,c` into lane names; returns the first problem as `error`. */
export function parseLaneList(list: string): { names: string[]; error?: string } {
  const names = list.split(',').map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return { names, error: 'Give at least one lane name, e.g. --lanes core,web.' };
  for (const name of names) {
    if (!isValidLaneName(name)) return { names, error: `"${name}" is not a valid lane name: use lowercase letters, digits and dashes, starting with a letter ("control" is reserved).` };
  }
  const dupe = names.find((n, i) => names.indexOf(n) !== i);
  return dupe ? { names, error: `Lane "${dupe}" is listed twice.` } : { names };
}

/** Lanes to add to `existing` (undefined = new config); throws with the reason when the result would be invalid. */
export function addLanes(existing: LanesConfig | undefined, additions: readonly Lane[]): LanesConfig {
  const base: LanesConfig = existing ?? { lanes: [], shared: [...DEFAULT_SHARED] };
  for (const lane of additions) {
    if (base.lanes.some((l) => l.name === lane.name)) throw new Error(`Lane "${lane.name}" already exists in .ai/lanes.json. Pick another name or edit the file.`);
  }
  const next: LanesConfig = { lanes: [...base.lanes, ...additions], shared: base.shared };
  const { errors } = validateLanesConfig(next);
  if (errors.length > 0) throw new Error(errors.join('\n'));
  return next;
}

/** Same shape as `mergeCard`: re-running is a no-op, and a broken marker pair is reported, not guessed at. */
export function mergeLanesSection(existing: string | undefined, section: string): string {
  const block = `${LANES_START}\n${section.trim()}\n${LANES_END}\n`;
  if (existing === undefined || existing.trim() === '') return block;
  const start = existing.indexOf(LANES_START);
  const end = existing.indexOf(LANES_END);
  if ((start === -1) !== (end === -1) || (start !== -1 && end < start)) {
    throw new Error(`CLAUDE.md has a broken ${LANES_START} / ${LANES_END} pair: fix or remove the markers, then re-run.`);
  }
  if (start !== -1) return existing.slice(0, start) + block + existing.slice(end + LANES_END.length).replace(/^\r?\n/, '');
  return `${existing.replace(/\s*$/, '')}\n\n${block}`;
}

export interface LanesPlanInput {
  config: LanesConfig;
  /** Lanes whose files should be created (all of them for init, one for `lanes add`). */
  newLanes: readonly string[];
  templates: LaneTemplates;
  existing: ReadonlyMap<string, string>;
  force: boolean;
}

/**
 * Files for a laned repo. Config is rewritten only when it changed; task, outbox and control-room files are loop
 * state, created if absent and never overwritten, even with `force`.
 */
export function planLanes({ config, newLanes, templates, existing, force }: LanesPlanInput): InitAction[] {
  const actions: InitAction[] = [];
  const json = `${JSON.stringify(config, null, 2)}\n`;
  const current = existing.get('.ai/lanes.json');
  if (current === undefined) actions.push({ dest: '.ai/lanes.json', kind: 'create', content: json });
  else if (current === json) actions.push({ dest: '.ai/lanes.json', kind: 'skip', reason: 'already up to date' });
  else if (force || newLanes.length > 0) actions.push({ dest: '.ai/lanes.json', kind: 'update', content: json });
  else actions.push({ dest: '.ai/lanes.json', kind: 'skip', reason: 'exists with different lanes (use --force to replace, or `loop lanes add`)' });

  const state = (dest: string, content: string) => {
    if (existing.has(dest)) actions.push({ dest, kind: 'skip', reason: 'loop state, never overwritten' });
    else actions.push({ dest, kind: 'create', content });
  };
  for (const name of newLanes) {
    const lane = config.lanes.find((l) => l.name === name);
    const vars = { lane: name, owns: lane ? lane.owns.join(', ') : '', lanes: config.lanes.map((l) => l.name).join(', ') };
    state(`.ai/lanes/${name}/task.md`, fillPlaceholders(templates.task, vars));
    state(`.ai/lanes/${name}/outbox.md`, fillPlaceholders(templates.outbox, vars));
  }
  state('.ai/control-room.md', templates.controlRoom);

  const section = fillPlaceholders(templates.claudeSection, { lanes: config.lanes.map((l) => l.name).join(', ') });
  const claude = existing.get('CLAUDE.md');
  const merged = mergeLanesSection(claude, section);
  if (merged === claude) actions.push({ dest: 'CLAUDE.md', kind: 'skip', reason: 'lane section already installed' });
  else actions.push({ dest: 'CLAUDE.md', kind: claude === undefined ? 'create' : 'update', content: merged });
  return actions;
}
