import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DemoSnapshot } from '../core/types.js';
import { DEFAULT_RUNNER } from './settings.js';
import { withLabel } from './checkLabels.js';
import { sortByAttention, toSummary } from './data.js';
import { CSP } from './static.js';

/** The only two hosts the static site may fetch from, besides itself: the live data path (src/server/live). */
export const LIVE_CONNECT_HOSTS: readonly string[] = ['https://api.github.com', 'https://raw.githubusercontent.com'];

/** The local server's CSP with `connect-src` widened to the live hosts. Everything else stays identical. */
export const STATIC_CSP = CSP.replace("connect-src 'self'", `connect-src 'self' ${LIVE_CONNECT_HOSTS.join(' ')}`);

/** `live.json` at the site root: which repo the hosted demo reads live, and which loop id to open first. */
export interface LiveConfig {
  repo: string;
  loop: string;
  /** The hosted demo's own URL: the live loop's site instead of its repo. */
  pages?: string;
}

export const SELF_LIVE_CONFIG: LiveConfig = { repo: 'Minntooos/Compounding-Loop', loop: 'compounding-loop', pages: 'https://minntooos.github.io/Compounding-Loop/' };

/**
 * GitHub Pages cannot set headers, so the CSP goes into a meta tag as the first child of `<head>`.
 * (`frame-ancestors` is ignored in a meta tag; Pages sends its own framing rules.)
 */
export function staticIndexHtml(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${STATIC_CSP.replace(/; frame-ancestors [^;]+/, '')}">`;
  if (!/<head[^>]*>/i.test(html)) throw new Error('index.html has no <head>');
  return html.replace(/<head[^>]*>/i, (head) => `${head}\n    ${meta}`);
}

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
  files.set('api/checks.json', snapshot.checks.map(withLabel));
  // Same body as the demo server's /api/settings; without the file the static site logged a 404 on every visit.
  files.set('api/settings.json', { demo: true, defaultRunner: DEFAULT_RUNNER });
  files.set('live.json', SELF_LIVE_CONFIG);
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
