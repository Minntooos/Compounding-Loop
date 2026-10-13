// Pure (no Node imports): has the version in package.json been released? Shipped = the tag `v<version>` exists and,
// when npm could be read, npm `latest` is that version (IDEA.md Round 5 A1).
import type { LoopRelease, NpmState } from '../core/types.js';

/** What the registry says about one package. */
export interface NpmFacts {
  /** The `latest` dist-tag. */
  latest: string;
  /** Every published version. */
  versions: string[];
}

/** Reads npm's package document (`registry.npmjs.org/<name>`); any other shape means the registry could not be read. */
export function parseNpmPackage(json: unknown): NpmFacts | undefined {
  if (typeof json !== 'object' || json === null) return undefined;
  const { 'dist-tags': tags, versions } = json as { 'dist-tags'?: unknown; versions?: unknown };
  if (typeof versions !== 'object' || versions === null) return undefined;
  const latest = typeof tags === 'object' && tags !== null ? (tags as { latest?: unknown }).latest : undefined;
  // No `latest` tag (e.g. every version unpublished) is as good as unreadable: the tag alone decides.
  return typeof latest === 'string' ? { latest, versions: Object.keys(versions) } : undefined;
}

/** The npm state of one version. */
export function npmStateOf(version: string, npm: NpmFacts | undefined): NpmState {
  if (!npm) return 'unknown';
  if (npm.latest === version) return 'latest';
  return npm.versions.includes(version) ? 'published' : 'not-published';
}

export interface ShippedFacts {
  version: string;
  tagExists: boolean;
  /** Undefined when npm was not checked or could not be read. */
  npm?: NpmFacts | undefined;
  /** When the tag's commit and the newest DONE.md commit were made, if known. A tag older than DONE.md belongs to the previous round. */
  tagAt?: Date | undefined;
  doneAt?: Date | undefined;
}

/** True once the tag exists (not older than DONE.md, when both dates are known) and npm, if readable, serves this version as `latest`. */
export function isShipped({ version, tagExists, npm, tagAt, doneAt }: ShippedFacts): boolean {
  if (!tagExists) return false;
  if (tagAt && doneAt && tagAt < doneAt) return false;
  return npm === undefined || npm.latest === version;
}

/**
 * CHANGELOG releases with their tag and npm state filled in (`Unreleased` has neither). `tags` or `npm` undefined means
 * that source was not checked: the field stays absent so the UI shows no chip instead of a wrong one.
 */
export function annotateReleases(releases: readonly LoopRelease[], tags: readonly string[] | undefined, npm: NpmFacts | undefined): LoopRelease[] {
  return releases.map((r) => (/^unreleased$/i.test(r.version) ? r : { ...r, ...(tags && { tag: tags.includes(`v${r.version}`) }), ...(npm && { npm: npmStateOf(r.version, npm) }) }));
}
