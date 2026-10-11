// Pure (no Node imports): the live dashboard runs this in the browser.
import type { ContractItem } from '../core/types.js';

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

/** The done-when items of a task.md; an item only counts as passing once the loop wrote DONE.md. */
export function contractFromTask(taskText: string, finished: boolean): ContractItem[] {
  return bulletsUnder(taskText, /^done when/i).map((text) => ({ text, pass: finished }));
}
