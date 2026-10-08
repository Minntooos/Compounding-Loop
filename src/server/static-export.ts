import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DemoSnapshot } from '../core/types.js';
import { sortByAttention, toSummary } from './data.js';

/**
 * The read-only API as plain files, for hosting the demo on GitHub Pages (no server there).
 * Keys are paths relative to the site root. The web app in static mode fetches these relative URLs.
 */
export function staticApiFiles(snapshot: DemoSnapshot, version: string): Map<string, unknown> {
  const files = new Map<string, unknown>();
  files.set('api/health.json', { ok: true, version, demo: true });
  files.set('api/loops.json', sortByAttention(snapshot.loops.map(toSummary)));
  for (const loop of snapshot.loops) files.set(`api/loops/${loop.id}.json`, loop);
  files.set('api/inbox.json', snapshot.inbox);
  files.set('api/checks.json', snapshot.checks);
  return files;
}

export async function writeStaticApi(outDir: string, snapshot: DemoSnapshot, version: string): Promise<string[]> {
  const written: string[] = [];
  for (const [relative, data] of staticApiFiles(snapshot, version)) {
    const file = path.join(outDir, ...relative.split('/'));
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
    written.push(relative);
  }
  return written;
}
