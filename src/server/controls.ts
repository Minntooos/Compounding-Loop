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

/** GitHub answers 414 above roughly 8 KB; stay well under it. */
export const MAX_URL_LENGTH = 7500;

/** A branch name keeps its slashes (`feature/x`) and encodes every other character. */
const encodeBranch = (branch: string) => branch.split('/').map(encodeURIComponent).join('/');
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const encodePath = (file: string) => checkedPath(file).split('/').map(encodeURIComponent).join('/');

/** GitHub's "new file" page with the file name and content filled in. */
export function newFileUrl(slug: string, file: string, content: string, branch = 'main'): string {
  const url = `${GITHUB}/${checkedSlug(slug)}/new/${encodeBranch(branch)}?filename=${encodeURIComponent(checkedPath(file))}&value=${encodeURIComponent(content)}`;
  // The caller falls back to "copy the text, then open the blank new-file page".
  if (url.length > MAX_URL_LENGTH) throw new RangeError(`content too long for a prefilled GitHub URL (${url.length} > ${MAX_URL_LENGTH})`);
  return url;
}

/** GitHub's delete page for a file (the confirmation commit happens on GitHub). */
export function deleteFileUrl(slug: string, file: string, branch = 'main'): string {
  return `${GITHUB}/${checkedSlug(slug)}/delete/${encodeBranch(branch)}/${encodePath(file)}`;
}

/** GitHub's web editor for a file, e.g. BLOCKED.md. */
export function editFileUrl(slug: string, file: string, branch = 'main'): string {
  return `${GITHUB}/${checkedSlug(slug)}/edit/${encodeBranch(branch)}/${encodePath(file)}`;
}

/** Pause: the new-file page for `.ai/PAUSED` with the one-line content core writes (`who · paused <ISO>[ · reason]`). */
export function pauseUrl(slug: string, by: string, now: Date, reason?: string, branch = 'main'): string {
  return newFileUrl(slug, PAUSED_FILE, formatPaused(oneLine(by) || 'dashboard', now, (reason && oneLine(reason)) || undefined), branch);
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

/** True when `nextRoundUrl` can carry this brief; otherwise the UI offers Copy and the blank new-file page. */
export function briefFitsUrl(slug: string, brief: string): boolean {
  try {
    nextRoundUrl(slug, brief);
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}
