// Brief linter. Pure and free of Node imports: the web wizard runs the same code in the browser.

export interface BriefGap {
  /** Stable id for tests and UI keys. */
  id: 'one-line' | 'audience' | 'must-haves' | 'vague-must-haves' | 'done-when' | 'out-of-scope' | 'length';
  /** What is missing, in one sentence. */
  message: string;
  /** Points lost. */
  cost: number;
}

export interface BriefLint {
  /** 0–100. `loop init` and `loop new` refuse below MIN_BRIEF_SCORE unless `--force`. */
  score: number;
  gaps: BriefGap[];
}

export const MIN_BRIEF_SCORE = 60;

interface Section {
  heading: string;
  /** Own text plus the text of deeper sub-headings, so "### Core" bullets count for "## Must have". */
  body: string;
}

const VAGUE_WORDS = /\b(good|nice|great|modern|fast|clean|user-friendly|intuitive|robust|scalable|beautiful)\b/i;
const MIN_WORDS = 120;
/** Bold labels (`**Goal:** text`) count as the deepest heading level. */
const LABEL_LEVEL = 7;

function splitSections(text: string): Section[] {
  const flat: { heading: string; level: number; own: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    const label = /^\s*\*\*(.+?)\*\*:?\s*(.*)$/.exec(line) ?? /^\s*\*\*(.+?):\*\*\s*(.*)$/.exec(line);
    if (heading) flat.push({ heading: heading[2] ?? '', level: (heading[1] ?? '#').length, own: '' });
    else if (label && !/^\s*[-*+]\s/.test(line)) flat.push({ heading: (label[1] ?? '').replace(/:$/, ''), level: LABEL_LEVEL, own: `${label[2] ?? ''}\n` });
    else {
      const last = flat[flat.length - 1];
      if (last) last.own += `${line}\n`;
    }
  }
  return flat.map((section, i) => {
    let body = section.own;
    for (const later of flat.slice(i + 1)) {
      if (later.level <= section.level) break;
      body += later.own;
    }
    return { heading: section.heading, body };
  });
}

const findSection = (sections: Section[], pattern: RegExp) => sections.find((s) => pattern.test(s.heading));

/** Bullet and numbered-list items of a section body, without their markers. */
export function listItems(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((line) => /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/.exec(line)?.[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

/** A must-have is vague when it is very short, or leans on a fuzzy word with no number, path or command to check. */
export function isVagueItem(item: string): boolean {
  const hasEvidence = /`[^`]+`|\d/.test(item);
  if (item.split(/\s+/).length < 4 && !hasEvidence) return true;
  return VAGUE_WORDS.test(item) && !hasEvidence;
}

/** Scores a brief (the project's IDEA.md) and names what is missing. */
export function lintBrief(text: string): BriefLint {
  const sections = splitSections(text);
  const gaps: BriefGap[] = [];
  const miss = (gap: BriefGap) => gaps.push(gap);

  const oneLine = findSection(sections, /^\W*(one[- ]line|summary|overview|goal|what (this|it) is|pitch)\b/i);
  if (!oneLine || oneLine.body.trim().length < 20) {
    miss({ id: 'one-line', cost: 15, message: 'No one-line description of what you are building.' });
  }

  const audience = findSection(sections, /^\W*(who\b|audience|users?\b|customers?\b|target)/i);
  if (!audience || audience.body.trim().length < 20) {
    miss({ id: 'audience', cost: 15, message: 'No audience: say who this is for.' });
  }

  const mustHeading = findSection(sections, /^\W*(must[- ]?haves?|requirements?|features?|deliverables?|scope\b)/i);
  const items = mustHeading ? listItems(mustHeading.body) : [];
  if (items.length < 3) {
    miss({ id: 'must-haves', cost: 20, message: 'Fewer than three must-haves listed as bullets.' });
  } else {
    const vague = items.filter(isVagueItem);
    if (vague.length > items.length / 2) {
      miss({
        id: 'vague-must-haves',
        cost: 10,
        message: `Vague must-haves (${vague.length} of ${items.length}): add numbers, paths or commands that can be checked.`,
      });
    }
  }

  const doneWhen = findSection(sections, /^\W*(done[- ]when|definition of done|acceptance|success criteria)/i);
  const checkable = doneWhen ? /`[^`]+`|\b(npm|pnpm|yarn|pytest|make|cargo)\b|\btests?\s+(pass|green)/i.test(doneWhen.body) : false;
  if (!checkable) {
    miss({ id: 'done-when', cost: 25, message: 'No checkable done-when: list commands or tests that must pass.' });
  }

  const outOfScope = findSection(sections, /^\W*(out of scope|not in scope|non-goals?|not included|won'?t)/i);
  if (!outOfScope || outOfScope.body.trim().length < 10) {
    miss({ id: 'out-of-scope', cost: 15, message: 'No out-of-scope section: say what the loop must not build.' });
  }

  if (text.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
    miss({ id: 'length', cost: 10, message: `Under ${MIN_WORDS} words: too thin for an unattended build.` });
  }

  const score = Math.max(0, 100 - gaps.reduce((sum, gap) => sum + gap.cost, 0));
  return { score, gaps };
}

export const briefPasses = (lint: BriefLint): boolean => lint.score >= MIN_BRIEF_SCORE;
