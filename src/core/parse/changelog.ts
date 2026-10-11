// CHANGELOG.md (Keep a Changelog) into releases. Pure and browser-safe.

export interface ChangelogSection {
  /** The `###` title, e.g. "Added ("Showcase")"; empty for bullets directly under the version. */
  title: string;
  items: string[];
}

export interface Release {
  /** "Unreleased" or a version such as "0.3.0". */
  version: string;
  /** YYYY-MM-DD; undefined for Unreleased or a heading without a date. */
  date?: string;
  sections: ChangelogSection[];
  /** Every bullet of the release, in order. */
  items: string[];
}

const VERSION_HEADING = /^##\s+\[?([^\]\s]+)\]?(?:\s+[-–—]\s+(\d{4}-\d\d-\d\d))?\s*$/;

/** Releases newest first, as written in the file. Link reference lines (`[0.3.0]: https://...`) are ignored. */
export function parseChangelog(text: string): Release[] {
  const releases: Release[] = [];
  let current: Release | undefined;
  let section: ChangelogSection | undefined;
  for (const line of text.split(/\r?\n/)) {
    const heading = VERSION_HEADING.exec(line);
    if (heading) {
      current = { version: heading[1] as string, ...(heading[2] && { date: heading[2] }), sections: [], items: [] };
      section = undefined;
      releases.push(current);
      continue;
    }
    if (!current) continue;
    const sub = /^###\s+(.+?)\s*$/.exec(line);
    if (sub) {
      section = { title: sub[1] as string, items: [] };
      current.sections.push(section);
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.+?)\s*$/.exec(line);
    if (bullet) {
      if (!section) {
        section = { title: '', items: [] };
        current.sections.push(section);
      }
      section.items.push(bullet[1] as string);
      current.items.push(bullet[1] as string);
    }
  }
  return releases;
}

/** The release for `version` (a leading `v` is ignored), or undefined. */
export function releaseFor(releases: readonly Release[], version: string): Release | undefined {
  const wanted = version.replace(/^v/, '');
  return releases.find((r) => r.version.toLowerCase() === wanted.toLowerCase());
}
