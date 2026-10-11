// Pure (no Node imports): the live dashboard runs this in the browser.
import type { ContractItem, LaneNotes } from '../core/types.js';

/** Bullet lines ("- x") directly under the first heading or bold label that matches `label`. */
export function bulletsUnder(markdown: string, label: RegExp): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => label.test(l.replace(/^#+\s*|\*\*/g, '').trim()));
  if (start === -1) return [];
  const bullets: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^#+\s/.test(line)) break;
    const bullet = /^\s*[-*]\s+(.*\S)\s*$/.exec(line);
    if (bullet?.[1]) bullets.push(bullet[1]);
    else if (bullets.length > 0 && line.trim() === '') break;
  }
  return bullets;
}

/** The sentence of a `**Done when:** a; b; c.` line, split into its items (lane task files write the contract inline). */
function inlineDoneWhen(markdown: string): string[] {
  const text = /^\*\*done when:?\*\*:?\s*(.+?)\s*$/im.exec(markdown)?.[1];
  return text === undefined ? [] : text.split(/;\s+/).map((item) => item.replace(/\.$/, '').trim()).filter(Boolean);
}

/** The done-when items of a task.md (bullets, else the inline sentence); an item only counts as passing once the loop wrote DONE.md. */
export function contractFromTask(taskText: string, finished: boolean): ContractItem[] {
  const bullets = bulletsUnder(taskText, /^done when/i);
  return (bullets.length > 0 ? bullets : inlineDoneWhen(taskText)).map((text) => ({ text, pass: finished }));
}

/** One lane's contract, decisions and knowledge from its task.md. */
export function laneNotesFromTask(lane: string, taskText: string, finished: boolean): LaneNotes {
  return { lane, contract: contractFromTask(taskText, finished), decisions: bulletsUnder(taskText, /^decisions/i), knowledge: bulletsUnder(taskText, /^confirmed/i) };
}
