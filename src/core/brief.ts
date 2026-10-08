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
  body: string;
}

const VAGUE_WORDS = /\b(good|nice|great|modern|fast|clean|user-friendly|intuitive|robust|scalable|beautiful|etc)\b/i;
const MIN_WORDS = 120;

function splitSections(text: string): Section[] {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      current = { heading: heading[1] ?? '', body: '' };
      sections.push(current);
    } else if (current) {
      current.body += `${line}\n`;
    }
  }
  return sections;
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

  const oneLine = findSection(sections, /one line|summary|goal|what (this|it) is|pitch/i);
  if (!oneLine || oneLine.body.trim().length < 20) {
    miss({ id: 'one-line', cost: 15, message: 'No one-line description of what you are building.' });
  }

  const audience = findSection(sections, /who|audience|users?|customers?/i);
  if (!audience || audience.body.trim().length < 20) {
    miss({ id: 'audience', cost: 15, message: 'No audience: say who this is for.' });
  }

  const mustHeading = findSection(sections, /must[- ]have|requirements?|features?|scope|deliverables?/i);
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

  const doneWhen = findSection(sections, /done[- ]when|definition of done|acceptance|success criteria/i);
  const checkable = doneWhen ? /`[^`]+`|\bnpm\b|\bpytest\b|\btest(s)?\b/i.test(doneWhen.body) : false;
  if (!checkable) {
    miss({ id: 'done-when', cost: 25, message: 'No checkable done-when: list commands or tests that must pass.' });
  }

  const outOfScope = findSection(sections, /out of scope|not in scope|non-goals?|not included|won'?t/i);
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
