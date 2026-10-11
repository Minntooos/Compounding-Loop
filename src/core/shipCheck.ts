// "Is it ready to ship?" as a checklist (IDEA.md Round 4 B4). Pure and browser-safe: the CLI and the dashboard share it.
import { listItems } from './brief.js';
import { parseChangelog, releaseFor } from './parse/changelog.js';

export interface ShipFacts {
  /** `version` from package.json. */
  version: string;
  /** Text of the root DONE.md; undefined when the file is absent. */
  doneText?: string;
  changelogText?: string;
  /** Whether the git tag `v<version>` already exists. */
  tagExists: boolean;
  /** Whether `git status --porcelain` is empty. */
  treeClean: boolean;
  /** Newest `npm test` result from the run log (or `.ai/last-test.json`). */
  tests?: { passed: number; failed: number; at?: string };
}

export type ShipItemId = 'done' | 'findings' | 'changelog' | 'tag' | 'clean' | 'tests';

export interface ShipItem {
  id: ShipItemId;
  label: string;
  ok: boolean;
  /** Why, in one sentence. */
  detail: string;
}

export interface ShipCheck {
  ready: boolean;
  items: ShipItem[];
  /** Bullets from DONE.md's open-findings sections, for display. */
  openFindings: string[];
}

const FINDINGS_HEADING = /^#{1,6}\s+.*\b(open findings?|minor findings|unsure|not verified|known (?:issues|problems)|still open)\b/i;

/** Bullets under DONE.md headings that name open or uncertain things. */
export function openFindings(doneText: string): string[] {
  const lines = doneText.split(/\r?\n/);
  const found: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!FINDINGS_HEADING.test(lines[i] as string)) continue;
    const rest = lines.slice(i + 1);
    const end = rest.findIndex((l) => /^#{1,6}\s/.test(l));
    found.push(...listItems((end === -1 ? rest : rest.slice(0, end)).join('\n')));
  }
  return found;
}

const NONE = /^(none|nothing|n\/a|no (?:open )?findings?)\b/i;

export function shipCheck(facts: ShipFacts): ShipCheck {
  const findings = facts.doneText === undefined ? [] : openFindings(facts.doneText).filter((f) => !NONE.test(f));
  const blockers = findings.filter((f) => /\bblocker\b/i.test(f) && !/\b(?:no|not an?|non-?|zero|without)\s+(?:open\s+)?blockers?\b/i.test(f));
  const release = facts.changelogText === undefined ? undefined : releaseFor(parseChangelog(facts.changelogText), facts.version);
  const unreleased = facts.changelogText === undefined ? undefined : releaseFor(parseChangelog(facts.changelogText), 'Unreleased');
  const changelogOk = (release !== undefined && release.items.length > 0) || (unreleased !== undefined && unreleased.items.length > 0);
  const tests = facts.tests;

  const items: ShipItem[] = [
    { id: 'done', label: 'Round is done', ok: facts.doneText !== undefined, detail: facts.doneText !== undefined ? 'DONE.md is present.' : 'No root DONE.md: the control room writes it when every lane is done.' },
    {
      id: 'findings', label: 'No open blockers', ok: blockers.length === 0,
      detail: blockers.length > 0 ? `${blockers.length} open blocker${blockers.length === 1 ? '' : 's'} in DONE.md.` : findings.length > 0 ? `${findings.length} open finding${findings.length === 1 ? '' : 's'} listed in DONE.md, none a blocker.` : 'DONE.md lists no open findings.',
    },
    {
      id: 'changelog', label: 'CHANGELOG has this release', ok: changelogOk,
      detail: release && release.items.length > 0 ? `[${facts.version}] has ${release.items.length} entries.` : unreleased && unreleased.items.length > 0 ? `[Unreleased] has ${unreleased.items.length} entries to move under ${facts.version}.` : `No [${facts.version}] section and nothing under [Unreleased].`,
    },
    { id: 'tag', label: 'Tag is free', ok: !facts.tagExists, detail: facts.tagExists ? `Tag v${facts.version} already exists: bump the version first.` : `Tag v${facts.version} does not exist yet.` },
    { id: 'clean', label: 'Working tree is clean', ok: facts.treeClean, detail: facts.treeClean ? 'No uncommitted changes.' : 'Uncommitted changes: commit or discard them.' },
    {
      id: 'tests', label: 'Tests pass', ok: tests !== undefined && tests.failed === 0 && tests.passed > 0,
      detail: tests === undefined ? 'No test result yet: lane runs record one with `loop runs log --passed N --failed N`, or `npm test` can write .ai/last-test.json.' : tests.failed > 0 ? `${tests.failed} failing in the latest result${tests.at ? ` (${tests.at})` : ''}.` : tests.passed === 0 ? 'The latest result ran no tests.' : `${tests.passed} passed${tests.at ? ` (${tests.at})` : ''}.`,
    },
  ];
  return { ready: items.every((i) => i.ok), items, openFindings: findings };
}
