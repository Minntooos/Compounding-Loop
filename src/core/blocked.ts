export interface BlockedNote {
  /** The specific question the agent could not answer. */
  question: string;
  /** The agent's best guess; empty when the file has none. */
  bestGuess: string;
  raw: string;
}

function sectionText(text: string, label: RegExp): string {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => label.test(l.replace(/^#+\s*|\*\*/g, '').trim()));
  if (start === -1) return '';
  const first = (lines[start] ?? '').replace(/^#+\s*/, '').replace(/\*\*/g, '');
  const inline = first.replace(/^[^:]*:/, '').trim();
  const body: string[] = inline && first.includes(':') ? [inline] : [];
  for (const line of lines.slice(start + 1)) {
    if (/^#+\s/.test(line) || /^\s*\*\*[^*]+\*\*:?/.test(line)) break;
    body.push(line);
  }
  return body.join('\n').trim();
}

/** Pulls the question and best guess out of a BLOCKED.md, tolerating headings or bold labels. */
export function parseBlocked(text: string): BlockedNote {
  const question = sectionText(text, /^(the )?(specific )?question/i);
  const bestGuess = sectionText(text, /^(my |the )?best guess/i);
  return { question: question || text.trim(), bestGuess, raw: text };
}

/** The block appended to task.md so the next run sees the owner's answer as a decision. */
export function formatAnswer(note: BlockedNote, answer: string, date: string): string {
  const question = note.question.split(/\r?\n/)[0] ?? '';
  return `### Owner answer, ${date}\nQuestion: ${question}\nAnswer: ${answer.trim()}\n`;
}

/** Inserts an answer block under "## Decisions" (or at the end when the file has none). */
export function addAnswerToTask(taskText: string, block: string): string {
  const match = /^## Decisions[^\n]*\n/m.exec(taskText);
  if (!match) return `${taskText.replace(/\s*$/, '')}\n\n## Decisions\n${block}`;
  const at = match.index + match[0].length;
  return `${taskText.slice(0, at)}${block}\n${taskText.slice(at)}`;
}

export const BUDGET_EXTENSION = 30;

/** True when BLOCKED.md was written because the run budget ran out (it has no real question). */
export const isBudgetBlock = (text: string): boolean => /run budget/i.test(text);

/** Raises the limit of `Run: N / LIMIT` to N + BUDGET_EXTENSION; leaves other text alone. */
export function extendRunBudget(taskText: string, extra: number = BUDGET_EXTENSION): string {
  return taskText.replace(/^Run:\s*(\d+)\s*\/\s*\d+/m, (_whole, run: string) => `Run: ${run} / ${Number(run) + extra}`);
}
