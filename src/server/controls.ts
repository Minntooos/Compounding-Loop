// Pure (no Node imports): the GitHub pages the static dashboard opens instead of holding a token. Every URL is a
// function of the repo slug, so a user with write access to the repo is the only one who can finish the action.
import { formatPaused, PAUSED_FILE } from '../core/parse/index.js';
import { isRepoSlug } from './live/urls.js';

export const RELEASE_WORKFLOW = 'release.yml';
export const NEXT_ROUND_FILE = '.ai/next-round.md';

const GITHUB = 'https://github.com';
const API = 'https://api.github.com';

function checkedSlug(slug: string): string {
  if (!isRepoSlug(slug)) throw new Error(`not a GitHub repo slug: ${slug}`);
  return slug;
}

/** A repo-relative path with no way out of the repo (no `..`, no leading slash, no backslash). */
function checkedPath(file: string): string {
  if (file === '' || file.startsWith('/') || file.includes('\\') || file.split('/').some((part) => part === '..' || part === '')) throw new Error(`not a repo file path: ${file}`);
  return file;
}

const encodePath = (file: string) => checkedPath(file).split('/').map(encodeURIComponent).join('/');

/** GitHub's "new file" page with the file name and content filled in. */
export function newFileUrl(slug: string, file: string, content: string, branch = 'main'): string {
  return `${GITHUB}/${checkedSlug(slug)}/new/${encodeURIComponent(branch)}?filename=${encodeURIComponent(checkedPath(file))}&value=${encodeURIComponent(content)}`;
}

/** GitHub's delete page for a file (the confirmation commit happens on GitHub). */
export function deleteFileUrl(slug: string, file: string, branch = 'main'): string {
  return `${GITHUB}/${checkedSlug(slug)}/delete/${encodeURIComponent(branch)}/${encodePath(file)}`;
}

/** GitHub's web editor for a file, e.g. BLOCKED.md. */
export function editFileUrl(slug: string, file: string, branch = 'main'): string {
  return `${GITHUB}/${checkedSlug(slug)}/edit/${encodeURIComponent(branch)}/${encodePath(file)}`;
}

/** Pause: the new-file page for `.ai/PAUSED` with the one-line content core writes (`who · paused <ISO>[ · reason]`). */
export function pauseUrl(slug: string, by: string, now: Date, reason?: string, branch = 'main'): string {
  return newFileUrl(slug, PAUSED_FILE, formatPaused(by.trim() || 'dashboard', now, reason?.trim() || undefined), branch);
}

/** Resume: the delete page for `.ai/PAUSED`. */
export const resumeUrl = (slug: string, branch = 'main'): string => deleteFileUrl(slug, PAUSED_FILE, branch);

/** Start next round: the new-file page for `.ai/next-round.md` holding the brief; the next-round workflow takes over on push. */
export function nextRoundUrl(slug: string, brief: string, branch = 'main'): string {
  return newFileUrl(slug, NEXT_ROUND_FILE, brief.endsWith('\n') ? brief : `${brief}\n`, branch);
}

/** The Actions page where the owner presses "Run workflow" for the release workflow. */
export const releaseWorkflowUrl = (slug: string): string => `${GITHUB}/${checkedSlug(slug)}/actions/workflows/${RELEASE_WORKFLOW}`;

/** API URL for the latest run of the release workflow (the dashboard shows its result). */
export const latestReleaseRunApiUrl = (slug: string): string => `${API}/repos/${checkedSlug(slug)}/actions/workflows/${RELEASE_WORKFLOW}/runs?per_page=1`;

/** API URL listing the repo's tags (for the ship-check "tag does not exist yet" item). */
export const tagsApiUrl = (slug: string): string => `${API}/repos/${checkedSlug(slug)}/tags?per_page=100`;
