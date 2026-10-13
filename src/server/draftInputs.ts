import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { extractOpenFindings, extractOutOfScope, nextRoundNumber, type DraftInputs } from '../core/draftBrief.js';
import { parseLanesConfig } from '../core/lanes.js';
import { parseSteer, steerPath, unacknowledged } from '../core/parse/steer.js';
import { extractNextItems } from '../core/rounds.js';

const read = (dir: string, rel: string) => readFile(path.join(dir, ...rel.split('/')), 'utf8').catch(() => undefined);

/**
 * The ingredients `loop next-round --draft` puts in its prompt, for the dashboard's next-round dialog.
 * Mirrors `gatherDraftPrompt` in src/cli/draft.ts (core's), which does not export its inputs yet.
 */
export async function gatherDraftInputs(dir: string): Promise<DraftInputs> {
  const idea = (await read(dir, 'IDEA.md')) ?? '';
  const lanes = parseLanesConfig((await read(dir, '.ai/lanes.json')) ?? '').config?.lanes.map((l) => l.name) ?? [];
  const next: DraftInputs['next'] = [];
  for (const source of ['DONE.md', ...lanes.map((l) => `.ai/lanes/${l}/DONE.md`)]) {
    const items = extractNextItems((await read(dir, source)) ?? '');
    if (items.length) next.push({ source, items });
  }
  const findings: DraftInputs['findings'] = [];
  for (const file of (await readdir(path.join(dir, '.ai', 'audit')).catch(() => [] as string[])).filter((f) => f.endsWith('.md')).sort()) {
    findings.push(...extractOpenFindings(`.ai/audit/${file}`, (await read(dir, `.ai/audit/${file}`)) ?? ''));
  }
  const steer: DraftInputs['steer'] = [];
  for (const lane of lanes) {
    const entries = unacknowledged(parseSteer((await read(dir, steerPath(lane))) ?? ''));
    if (entries.length) steer.push({ lane, entries });
  }
  return { name: path.basename(dir), round: nextRoundNumber(idea), next, findings, steer, outOfScope: extractOutOfScope(idea) };
}
