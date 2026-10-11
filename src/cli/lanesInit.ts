import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { InitAction } from '../core/init.js';
import { parseLanesConfig, type Lane, type LanesConfig } from '../core/lanes.js';
import { addLanes, FALLBACK_LANE_TEMPLATES, planLanes, staggeredCron, type LaneTemplates } from '../core/lanesInit.js';
import { packageRoot } from './init.js';

const readIfExists = (file: string) => readFile(file, 'utf8').catch(() => undefined);

/** Reads `templates/lanes/{task,outbox,control-room,claude-section}.md` from the package, with built-in fallbacks. */
export async function loadLaneTemplates(root: string = packageRoot): Promise<{ templates: LaneTemplates; missing: string[] }> {
  const missing: string[] = [];
  const read = async (name: string, fallback: string) => {
    const text = await readIfExists(path.join(root, 'templates', 'lanes', name));
    if (text === undefined) missing.push(`templates/lanes/${name}`);
    return text ?? fallback;
  };
  const templates: LaneTemplates = {
    task: await read('task.md', FALLBACK_LANE_TEMPLATES.task),
    outbox: await read('outbox.md', FALLBACK_LANE_TEMPLATES.outbox),
    controlRoom: await read('control-room.md', FALLBACK_LANE_TEMPLATES.controlRoom),
    claudeSection: await read('claude-section.md', FALLBACK_LANE_TEMPLATES.claudeSection),
  };
  return { templates, missing };
}

export interface LanesResult {
  actions: InitAction[];
  missing: string[];
}

/** Adds lanes to the repo at `target` (creating `.ai/lanes.json` if needed) and writes their files. */
export async function runAddLanes(
  target: string,
  additions: readonly Lane[],
  options: { force: boolean; dryRun: boolean; /** `init --lanes` re-runs: lanes already in the config are kept, only their missing files are created. */ existingOk?: boolean },
  root: string = packageRoot,
): Promise<LanesResult> {
  const configText = await readIfExists(path.join(target, '.ai', 'lanes.json'));
  let existing: LanesConfig | undefined;
  if (configText !== undefined) {
    const parsed = parseLanesConfig(configText);
    if (!parsed.config) throw new Error(`.ai/lanes.json is invalid, so lanes cannot be added:\n- ${parsed.errors.join('\n- ')}`);
    existing = parsed.config;
  }
  const fresh = options.existingOk ? additions.filter((l) => !existing?.lanes.some((e) => e.name === l.name)) : additions;
  const config = addLanes(existing, fresh.map((l, i) => ({ ...l, cron: l.cron ?? staggeredCron((existing?.lanes.length ?? 0) + i) })));
  const { templates, missing } = await loadLaneTemplates(root);
  const current = new Map<string, string>();
  const dests = ['.ai/lanes.json', '.ai/control-room.md', 'CLAUDE.md', 'AGENTS.md', ...additions.flatMap((l) => [`.ai/lanes/${l.name}/task.md`, `.ai/lanes/${l.name}/outbox.md`])];
  for (const dest of dests) {
    const text = await readIfExists(path.join(target, ...dest.split('/')));
    if (text !== undefined) current.set(dest, text);
  }
  const actions = planLanes({ config, newLanes: additions.map((l) => l.name), templates, existing: current, force: options.force });
  if (!options.dryRun) {
    for (const action of actions) {
      if (action.content === undefined) continue;
      const file = path.join(target, ...action.dest.split('/'));
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, action.content);
    }
  }
  return { actions, missing };
}
