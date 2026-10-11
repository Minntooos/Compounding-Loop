import { buildLiveLoop, GITHUB_API, isRepoSlug, laneFilePaths, liveUrls, rawUrl, BASE_FILES, type LiveLoop } from '../../../src/server/live/index.js';
import { parseLanesConfig } from '../../../src/core/parse/index.js';

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** GitHub's anonymous API limit (60/h) was hit. `resetAt` is epoch ms when it resets, if GitHub said. */
export class RateLimitedError extends Error {
  constructor(readonly resetAt?: number) { super('GitHub rate limit reached'); }
}

export interface LiveConfig { repo: string; loop?: string }

/** Reads and validates the static site's `live.json`; anything unexpected means "no live mode". */
export async function readLiveConfig(fetchFn: Fetch, url = 'live.json'): Promise<LiveConfig | undefined> {
  try {
    const res = await fetchFn(url, { headers: { accept: 'application/json' } });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return undefined;
    const body = (await res.json()) as { repo?: unknown; loop?: unknown };
    if (typeof body.repo !== 'string' || !isRepoSlug(body.repo)) return undefined;
    return { repo: body.repo, ...(typeof body.loop === 'string' && body.loop && { loop: body.loop }) };
  } catch { return undefined; }
}

async function apiJson(fetchFn: Fetch, url: string): Promise<unknown> {
  const res = await fetchFn(url, { headers: { accept: 'application/vnd.github+json' } });
  if (res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get('x-ratelimit-reset'));
    throw new RateLimitedError(Number.isFinite(reset) && reset > 0 ? reset * 1000 : undefined);
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return res.json();
}

/** A 404 is "file absent" (undefined); any other failure throws so the caller falls back to the snapshot. */
async function rawText(fetchFn: Fetch, url: string): Promise<string | undefined> {
  const res = await fetchFn(url);
  if (res.status === 404) return undefined;
  if (!res.ok) throw new Error(`GitHub answered ${res.status}`);
  return res.text();
}

/** Paths of every file on `main`, so absent files are never requested (a 404 is a red line in the browser console). Undefined when the listing is unusable. */
async function listFiles(fetchFn: Fetch, slug: string): Promise<Set<string> | undefined> {
  try {
    const tree = (await apiJson(fetchFn, `${GITHUB_API}/repos/${slug}/git/trees/main?recursive=1`)) as { tree?: unknown; truncated?: unknown };
    if (!Array.isArray(tree.tree) || tree.truncated === true) return undefined;
    return new Set(tree.tree.flatMap((n: { path?: unknown }) => (typeof n?.path === 'string' ? [n.path] : [])));
  } catch (e) {
    if (e instanceof RateLimitedError) throw e;
    return undefined;
  }
}

async function fetchFiles(fetchFn: Fetch, slug: string, paths: readonly string[], present?: Set<string>): Promise<Record<string, string | undefined>> {
  const texts = await Promise.all(paths.map((p) => (present && !present.has(p) ? undefined : rawText(fetchFn, rawUrl(slug, p)))));
  return Object.fromEntries(paths.map((p, i) => [p, texts[i]]));
}

/** Fetches a repo's public state from GitHub and maps it with the server's pure builder. */
export async function loadLive(fetchFn: Fetch, config: LiveConfig, now: Date): Promise<LiveLoop> {
  const urls = liveUrls(config.repo);
  const present = await listFiles(fetchFn, config.repo);
  const [commits, runs, base] = await Promise.all([
    apiJson(fetchFn, urls.commits),
    // The runs list is optional garnish: losing it must not lose the page.
    apiJson(fetchFn, urls.runs).catch((e: unknown) => { if (e instanceof RateLimitedError) throw e; return {}; }),
    fetchFiles(fetchFn, config.repo, BASE_FILES, present),
  ]);
  const lanesText = base['.ai/lanes.json'];
  const lanes = lanesText === undefined ? [] : (parseLanesConfig(lanesText).config?.lanes ?? []);
  const laneFiles = await fetchFiles(fetchFn, config.repo, laneFilePaths(lanes.map((l) => l.name)), present);
  return buildLiveLoop({ slug: config.repo, ...(config.loop && { id: config.loop }), commits, runs, files: { ...base, ...laneFiles }, now });
}
