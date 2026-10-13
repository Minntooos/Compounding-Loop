import type { InboxItem, LoopSummary } from '../../../src/core/types.js';
import { SCHEDULE_FILE } from '../../../src/core/parse/schedule.js';
import { editFileUrl } from '../../../src/server/controls.js';
import { slugOf } from './controls.js';
import { ROUTINES_OFF_TEXT, type AttentionItem } from './lanes.js';

/** Row groups in the order DESIGN.md §12 C2 lists them: what blocks work first. */
export type RowGroup = 'question' | 'failing' | 'stalled' | 'release';
const GROUP_ORDER: RowGroup[] = ['question', 'failing', 'stalled', 'release'];

export interface RowAction {
  label: string;
  href: string;
  /** Opens GitHub in a new tab. */
  external?: boolean;
}

export interface NeedsYouRow {
  key: string;
  group: RowGroup;
  loopId: string;
  loopName: string;
  /** What happened, in plain words. */
  text: string;
  action: RowAction;
  /** One paragraph behind "What this means", for rows whose cause is not obvious. */
  explain?: string;
}

const STALLED_EXPLAIN =
  'A lane was due but left no run line. Usually the plan’s five-hour usage limit stopped the routine, or the routine is switched off. ' +
  'Nothing is lost: the lane continues from its task file on its next run. Waking it clears a sleep or snooze in .ai/schedule.json.';

const ROUTINES_OFF_EXPLAIN =
  'No lane has logged a run for 6 hours although runs were due. A plan’s usage limit resets within 5 hours, so the scheduled ' +
  'routines themselves are probably switched off, deleted or failing to start. Check them where you created them (claude.ai or ' +
  'your runner), then wake any lane .ai/schedule.json holds back. The lanes continue from their task files.';

const loopHref = (id: string) => `#/loop/${encodeURIComponent(id)}`;

/** "Edit on GitHub" is the one label for every demo action that opens GitHub's editor. */
function editOnGitHub(slug: string | undefined, file: string, fallback: RowAction): RowAction {
  return slug ? { label: 'Edit on GitHub', href: editFileUrl(slug, file), external: true } : fallback;
}

function rowFor(a: AttentionItem, loop: Pick<LoopSummary, 'name' | 'reason' | 'url' | 'repoUrl'> | undefined, demo: boolean): Omit<NeedsYouRow, 'key' | 'loopId' | 'loopName'> {
  const slug = demo ? slugOf(loop?.repoUrl ?? loop?.url) : undefined;
  const open = { label: 'Open loop', href: loopHref(a.loopId) };
  const wake = demo ? editOnGitHub(slug, SCHEDULE_FILE, open) : open;
  switch (a.kind) {
    case 'inbox': {
      const it: Pick<InboxItem, 'kind' | 'file' | 'question'> = a.item;
      if (it.kind === 'release') return { group: 'release', text: 'Round done · release waiting on you', action: { label: 'Review & release', href: loopHref(a.loopId) } };
      if (it.kind === 'lanes-not-running') return { group: 'stalled', text: it.question, action: wake, explain: STALLED_EXPLAIN };
      if (it.kind === 'paused') return { group: 'stalled', text: it.question, action: open };
      const action = demo ? editOnGitHub(slug, it.file, { label: 'Answer', href: '#/inbox' }) : { label: 'Answer', href: '#/inbox' };
      return { group: 'question', text: it.question.split('\n')[0] ?? it.question, action };
    }
    case 'lane':
      if (a.lane.state === 'blocked') return { group: 'question', text: `Lane ${a.lane.name} is blocked`, action: demo ? editOnGitHub(slug, `.ai/lanes/${a.lane.name}/BLOCKED.md`, open) : open };
      if (a.lane.state === 'stalled') return { group: 'stalled', text: `Lane ${a.lane.name} is stalled`, action: wake, explain: STALLED_EXPLAIN };
      return { group: 'stalled', text: `Lane ${a.lane.name} waits on a finished lane`, action: open };
    case 'failing': return { group: 'failing', text: `Failing${loop?.reason ? ` · ${loop.reason}` : ''}`, action: { label: 'Open checks', href: '#/health' } };
    case 'release': return { group: 'release', text: 'Round done · release waiting on you', action: { label: 'Review & release', href: loopHref(a.loopId) } };
    case 'routines-off': return { group: 'stalled', text: ROUTINES_OFF_TEXT, action: wake, explain: ROUTINES_OFF_EXPLAIN };
  }
}

/**
 * One row per attention item (the same list as the banner count and the nav badge), with its action inline,
 * ordered: questions, failing, stalled, release waiting. `demo` is the static site, where actions open GitHub's editor.
 */
export function needsYouRows(items: AttentionItem[], loops: Pick<LoopSummary, 'id' | 'name' | 'reason' | 'url' | 'repoUrl'>[], demo: boolean): NeedsYouRow[] {
  const rows = items.map((a, i): NeedsYouRow => {
    const loop = loops.find((l) => l.id === a.loopId);
    return { key: `${a.loopId}/${a.kind}/${i}`, loopId: a.loopId, loopName: loop?.name ?? a.loopId, ...rowFor(a, loop, demo) };
  });
  return GROUP_ORDER.flatMap((g) => rows.filter((r) => r.group === g));
}
