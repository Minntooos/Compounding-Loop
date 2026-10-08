import { listItems } from './brief.js';

/** Items under the "next 10 improvements" heading of a DONE.md; empty when the section is missing. */
export function extractNextItems(doneText: string): string[] {
  const lines = doneText.split(/\r?\n/);
  // Any heading about what comes next ("Next 10 improvements", "Ten best next pages", "Next steps").
  const start = lines.findIndex((line) => /^#{1,6}\s+.*\b(next|ten best)\b/i.test(line));
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^#{1,6}\s/.test(line));
  return listItems((end === -1 ? rest : rest.slice(0, end)).join('\n'));
}

/** Next archive name: one above the highest existing `done-vN.md` (so gaps never collide). */
export function nextDoneFileName(fileNames: readonly string[]): string {
  const numbers = fileNames.flatMap((name) => {
    const match = /^done-v(\d+)\.md$/.exec(name);
    return match ? [Number(match[1])] : [];
  });
  return `done-v${Math.max(0, ...numbers) + 1}.md`;
}

/** Writes the next round's task.md from the items; `round` is the number of the round being started. */
export function buildNextRoundTask(items: readonly string[], round: number, runLimit = 30): string {
  const units = items.map((item, i) => `${i + 1}. ${item}`).join('\n');
  return `# TASK: Round ${round}, improvements from the previous DONE.md

Run: 0 / ${runLimit}
Status: not started

## Contract
- Goal: ship the units below, most valuable first, without breaking what already passes.
- Done when: \`npm test\` passes and every unit has a test that proves it.
- Constraints: see CLAUDE.md hard rules.
- Out of scope: anything not listed under Units.

## Units, in order
${units}

## Decisions

## Confirmed

## Guesses

## Tried

## Handoff
(each run ends by writing: where it stopped, the exact next step, anything half-done)
`;
}
