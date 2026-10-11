// Pure (no Node imports): which GitHub URLs the browser must fetch to build a live loop.

export const GITHUB_API = 'https://api.github.com';
export const GITHUB_RAW = 'https://raw.githubusercontent.com';

/** `.ai/done-vN.md` files probed to count finished rounds (a missing file is a 404, which is fine). */
export const MAX_ROUND_FILES = 9;

const SLUG = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

export function isRepoSlug(slug: string): boolean {
  return SLUG.test(slug) && !slug.split('/').some((part) => part === '.' || part === '..');
}

export interface LiveUrls {
  commits: string;
  runs: string;
  /** Files read first: the lane list decides which per-lane files come next. */
  files: Record<string, string>;
}

/** Repo-relative paths of the files every loop has, laned or not. */
export const BASE_FILES: readonly string[] = [
  '.ai/task.md',
  '.ai/lanes.json',
  'DONE.md',
  'BLOCKED.md',
  ...Array.from({ length: MAX_ROUND_FILES }, (_, i) => `.ai/done-v${i + 1}.md`),
];

/** Per-lane files, once `.ai/lanes.json` is known. */
export function laneFilePaths(lanes: readonly string[]): string[] {
  return lanes.flatMap((lane) => ['task.md', 'outbox.md', 'DONE.md', 'BLOCKED.md', 'claim'].map((f) => `.ai/lanes/${lane}/${f}`));
}

export function rawUrl(slug: string, file: string, branch = 'main'): string {
  return `${GITHUB_RAW}/${slug}/${branch}/${file}`;
}

/** Everything the browser fetches for `slug`; throws on anything that is not `owner/name`. */
export function liveUrls(slug: string, branch = 'main'): LiveUrls {
  if (!isRepoSlug(slug)) throw new Error(`not a GitHub repo slug: ${slug}`);
  return {
    commits: `${GITHUB_API}/repos/${slug}/commits?sha=${encodeURIComponent(branch)}&per_page=100`,
    runs: `${GITHUB_API}/repos/${slug}/actions/runs?branch=${encodeURIComponent(branch)}&per_page=20`,
    files: Object.fromEntries(BASE_FILES.map((file) => [file, rawUrl(slug, file, branch)])),
  };
}

/** Number of `.ai/done-vN.md` files present, counted from the fetched files. */
export function countRoundFiles(files: Readonly<Record<string, string | undefined>>): number {
  return Array.from({ length: MAX_ROUND_FILES }, (_, i) => files[`.ai/done-v${i + 1}.md`]).filter((t) => t !== undefined).length;
}
