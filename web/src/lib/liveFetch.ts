import { buildLiveLoop, commitsSinceUrl, npmPackageUrl, packageName, packageVersion, tagLookupApiUrl, tagsApiUrl, GITHUB_API, hasMoreCommits, snapshotSince, isRepoSlug, laneFilePaths, liveUrls, rawUrl, BASE_FILES, type LiveLoop } from '../../../src/server/live/index.js';
import { parseLanesConfig } from '../../../src/core/parse/index.js';
import type { LoopCommit } from '../../../src/core/types.js';

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

/** Safety stop for the paged commit fetch: 10 pages is 1000 commits, far more than a snapshot is ever behind. */
const MAX_COMMIT_PAGES = 10;

/** Commits newer than the snapshot's head, every page concatenated; without a snapshot, just the newest 100. */
async function fetchCommits(fetchFn: Fetch, slug: string, firstPageUrl: string, snapshot: readonly LoopCommit[]): Promise<unknown[]> {
  const since = snapshotSince(snapshot);
  if (since === undefined) return (await apiJson(fetchFn, firstPageUrl)) as unknown[];
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_COMMIT_PAGES; page++) {
    const entries = (await apiJson(fetchFn, commitsSinceUrl(slug, since, page))) as unknown[];
    all.push(...entries);
    if (!Array.isArray(entries) || !hasMoreCommits(entries.length)) break;
  }
  return all;
}

/** Fetches a repo's public state from GitHub and maps it with the server's pure builder. */
export async function loadLive(fetchFn: Fetch, config: LiveConfig, now: Date, snapshot: readonly LoopCommit[] = []): Promise<LiveLoop> {
  const urls = liveUrls(config.repo);
  const present = await listFiles(fetchFn, config.repo);
  const [commits, runs, base] = await Promise.all([
    fetchCommits(fetchFn, config.repo, urls.commits, snapshot),
    // The runs list is optional garnish: losing it must not lose the page.
    apiJson(fetchFn, urls.runs).catch((e: unknown) => { if (e instanceof RateLimitedError) throw e; return {}; }),
    fetchFiles(fetchFn, config.repo, BASE_FILES, present),
  ]);
  const lanesText = base['.ai/lanes.json'];
  const lanes = lanesText === undefined ? [] : (parseLanesConfig(lanesText).config?.lanes ?? []);
  const pkg = base['package.json'];
  const version = packageVersion(pkg);
  const [laneFiles, tags] = await Promise.all([
    fetchFiles(fetchFn, config.repo, laneFilePaths(lanes.map((l) => l.name)), present),
    releaseTags(fetchFn, config.repo, version),
  ]);
  // npm answers 404 (a red console line) for a package that was never published, so ask only once the version is tagged.
  const tagged = version !== undefined && (tags ?? []).some((t) => isTag(t, `v${version}`));
  const npm = tagged ? await npmDocument(fetchFn, packageName(pkg)) : undefined;
  return buildLiveLoop({
    slug: config.repo, ...(config.loop && { id: config.loop }), commits, runs, ...(snapshot.length > 0 && { snapshotCommits: snapshot }),
    files: { ...base, ...laneFiles }, now, ...(tags !== undefined && { tags }), ...(npm !== undefined && { npm }),
  });
}

/**
 * The repo's newest 100 tags (for every Releases row) plus the exact `v<version>` lookup (A1 "shipped"; not capped at 100),
 * as one array of tag items; undefined when GitHub answered neither, so nothing is claimed about tags.
 */
async function releaseTags(fetchFn: Fetch, slug: string, version: string | undefined): Promise<unknown[] | undefined> {
  // Garnish, like the runs list: a rate limit here must not lose the page.
  const get = (url: string) => apiJson(fetchFn, url).then((j) => (Array.isArray(j) ? (j as unknown[]) : undefined), () => undefined);
  const [list, exact] = await Promise.all([get(tagsApiUrl(slug)), version === undefined ? undefined : get(tagLookupApiUrl(slug, version))]);
  return list === undefined && exact === undefined ? undefined : [...(list ?? []), ...(exact ?? [])];
}

/** npm's package document (the registry allows any origin); undefined for a repo without a package name or when npm is unreachable. */
async function npmDocument(fetchFn: Fetch, name: string | undefined): Promise<unknown> {
  if (name === undefined) return undefined;
  try {
    const res = await fetchFn(npmPackageUrl(name), { headers: { accept: 'application/json' } });
    return res.ok ? ((await res.json()) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

/** A GitHub tags item (`name`) or matching-refs item (`ref: refs/tags/<name>`) for exactly this tag. */
function isTag(item: unknown, tag: string): boolean {
  const { name, ref } = (typeof item === 'object' && item !== null ? item : {}) as { name?: unknown; ref?: unknown };
  return name === tag || ref === `refs/tags/${tag}`;
}
