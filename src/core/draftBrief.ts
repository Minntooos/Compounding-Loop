// The prompt that asks Claude to draft the next round's brief. Pure and free of Node imports: the server streams the
// same prompt and the demo offers it as "Copy prompt for Claude Code".
import { listItems } from './brief.js';
import type { SteerEntry } from './types.js';

export interface DraftInputs {
  name: string;
  /** The round being drafted. */
  round: number;
  /** "Next 10" lists per DONE.md (source is the file, e.g. `DONE.md` or `.ai/lanes/core/DONE.md`). */
  next: { source: string; items: string[] }[];
  /** Audit rows still open, one line each. */
  findings: { source: string; text: string }[];
  /** Steer entries nobody has acknowledged yet, by lane. */
  steer: { lane: string; entries: SteerEntry[] }[];
  /** The previous brief's out-of-scope items. */
  outOfScope: string[];
}

const cell = (c: string) => c.replace(/\*\*|`/g, '').trim();

/** Audit table rows whose last cell says the finding is still open. */
export function extractOpenFindings(source: string, auditText: string): { source: string; text: string }[] {
  const out: { source: string; text: string }[] = [];
  for (const line of auditText.split(/\r?\n/)) {
    if (!line.startsWith('|') || /^\|[\s:|-]+\|?$/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map(cell);
    const last = cells.at(-1) ?? '';
    if (cells.length >= 2 && /\bopen\b/i.test(last) && !/^fixed/i.test(last)) out.push({ source, text: cells.slice(0, -1).filter(Boolean).join(' · ').slice(0, 300) });
  }
  return out;
}

/** The list under the first "Out of scope" line of a brief (heading or bold label). */
export function extractOutOfScope(ideaText: string): string[] {
  const lines = ideaText.split(/\r?\n/);
  const start = lines.findIndex((l) => /out of scope/i.test(l) && /^(#{1,6}\s|\s*\*\*)/.test(l));
  if (start < 0) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => /^#{1,6}\s|^---/.test(l));
  return listItems((end < 0 ? rest : rest.slice(0, end)).join('\n'));
}

const bullets = (items: readonly string[]) => (items.length ? items.map((i) => `- ${i}`).join('\n') : '(none)');

/** The prompt text. It states the brief format the linter scores, so the draft passes `loop next-round --brief`. */
export function buildDraftPrompt(input: DraftInputs): string {
  const next = input.next.map((n) => `From ${n.source}:\n${bullets(n.items)}`).join('\n\n') || '(no DONE.md lists yet)';
  const findings = bullets(input.findings.map((f) => `${f.source}: ${f.text}`));
  const steer = input.steer.flatMap((s) => s.entries.map((e) => `- ${s.lane} (${e.scope}, ${e.author}): ${e.text.replace(/\s+/g, ' ')}`));
  return `You are drafting the brief for round ${input.round} of ${input.name}, a repo built by unattended Claude Code lanes. Use only the inputs below; do not edit files or run commands. Answer with the brief as Markdown and nothing else.

## Inputs

### Next-improvement lists from the finished round
${next}

### Open audit findings
${findings}

### Steering notes not yet acted on
${steer.length ? steer.join('\n') : '(none)'}

### Out of scope in the previous brief (keep unless an input above says otherwise)
${bullets(input.outOfScope)}

## Format (an automated check scores it; below 60 it is refused)
- A heading "## Round ${input.round}: <version and a short name>".
- "**What we are building:**" and "**Audience:**" lead-ins, one or two sentences each.
- Must-haves as lettered sections ("### A. ...", "### B. ...") with numbered items. Each item names a path, a command or a number that a test can check. Put the highest-value work first and bugs before features.
- A "### Round ${input.round} done when" section whose bullets are commands or tests (for example \`npm test\` passes).
- "**Out of scope:**" with a bullet list.
- Fit what unattended lanes can finish in about three days. Drop inputs that do not fit and say nothing about them.
`;
}

/** Arguments for a read-only `claude -p` draft: no edits, no shell. The prompt is one argv entry. */
export function draftClaudeArgs(prompt: string, model?: string): string[] {
  return ['-p', prompt, ...(model ? ['--model', model] : []), '--permission-mode', 'default', '--allowedTools', 'Read,Glob,Grep'];
}

/** The number of the round to draft: one above the highest `Round N` heading (2 when the brief has none, so it is round 1). */
export function nextRoundNumber(ideaText: string): number {
  const numbers = [...ideaText.matchAll(/^#{1,3}\s+Round\s+(\d+)\b/gim)].map((m) => Number(m[1]));
  return Math.max(1, ...numbers) + 1;
}
