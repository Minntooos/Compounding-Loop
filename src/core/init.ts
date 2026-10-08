// Planning for `loop init`: decides what to write, without touching the disk.
import { briefPasses, lintBrief } from './brief.js';

export const CARD_START = '<!-- compounding-loop:start -->';
export const CARD_END = '<!-- compounding-loop:end -->';

/** A file the kit wants installed, with its path relative to the target repo (always `/`-separated). */
export interface KitFile {
  dest: string;
  content: string;
}

export interface InitAction {
  dest: string;
  kind: 'create' | 'update' | 'overwrite' | 'skip';
  /** Present unless the action is `skip`. */
  content?: string;
  reason?: string;
}

export interface InitPlanInput {
  /** Files copied as-is when absent (never overwritten without `force`). */
  kit: KitFile[];
  /** The Operating Card text, merged into CLAUDE.md between markers. Undefined when the kit has none yet. */
  card: string | undefined;
  /** Current contents of files in the target repo, keyed by `/`-separated relative path. */
  existing: ReadonlyMap<string, string>;
  force: boolean;
}

const AGENTS_POINTER = '# AGENTS.md\n\nThis repository follows the rules in [CLAUDE.md](CLAUDE.md). Read it first; it applies to any coding agent.\n';

/** Wraps the card in markers and merges it into an existing CLAUDE.md. Re-running is a no-op. */
export function mergeCard(existing: string | undefined, card: string): string {
  const block = `${CARD_START}\n${card.trim()}\n${CARD_END}\n`;
  if (existing === undefined || existing.trim() === '') return block;
  const start = existing.indexOf(CARD_START);
  const end = existing.indexOf(CARD_END);
  if (start !== -1 && end > start) {
    return existing.slice(0, start) + block + existing.slice(end + CARD_END.length).replace(/^\r?\n/, '');
  }
  return `${existing.replace(/\s*$/, '')}\n\n${block}`;
}

/** Returns why a brief blocks `init`, or undefined when it is good enough. */
export function briefBlocker(brief: string | undefined): string | undefined {
  if (brief === undefined) return 'IDEA.md is missing: write the brief first (or pass --force).';
  const lint = lintBrief(brief);
  if (briefPasses(lint)) return undefined;
  const gaps = lint.gaps.map((gap) => `  - ${gap.message}`).join('\n');
  return `IDEA.md scores ${lint.score}/100 (needs 60):\n${gaps}`;
}

export function planInit({ kit, card, existing, force }: InitPlanInput): InitAction[] {
  const actions: InitAction[] = [];
  for (const file of kit) {
    const current = existing.get(file.dest);
    if (current === undefined) actions.push({ dest: file.dest, kind: 'create', content: file.content });
    else if (current === file.content) actions.push({ dest: file.dest, kind: 'skip', reason: 'already up to date' });
    else if (force) actions.push({ dest: file.dest, kind: 'overwrite', content: file.content });
    else actions.push({ dest: file.dest, kind: 'skip', reason: 'exists (use --force to overwrite)' });
  }

  if (card !== undefined) {
    const current = existing.get('CLAUDE.md');
    const merged = mergeCard(current, card);
    if (merged === current) actions.push({ dest: 'CLAUDE.md', kind: 'skip', reason: 'Operating Card already installed' });
    else actions.push({ dest: 'CLAUDE.md', kind: current === undefined ? 'create' : 'update', content: merged });
  }

  const agents = existing.get('AGENTS.md');
  if (agents === undefined) actions.push({ dest: 'AGENTS.md', kind: 'create', content: AGENTS_POINTER });
  else actions.push({ dest: 'AGENTS.md', kind: 'skip', reason: 'exists' });
  return actions;
}
