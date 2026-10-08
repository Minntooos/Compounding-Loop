import { fillPlaceholders } from './template.js';

/** Used only when neither the repo nor the package ships a prompt file. Mirrors templates/static-site/.ai/loop-prompt.md. */
export const DEFAULT_PROMPT = `You are one run of an unattended build loop for this repository. Nobody is watching. Follow CLAUDE.md exactly, especially "Unattended mode".

0. Run \`git checkout main && git pull --ff-only\`. Commit to \`main\` and push with \`git push origin main\`. Never push to a \`claude/\` branch.
1. If \`DONE.md\` or \`BLOCKED.md\` exists, reply "Nothing to do" and stop.
2. Run the install commands in CLAUDE.md "Commands".
3. If \`.ai/task.md\` exists, run the resume protocol (.ai/method.md section 9.2) and add 1 to its run counter. If the counter has reached its limit, follow "Run budget" in CLAUDE.md. Otherwise start the task from IDEA.md.
4. Do one unit of work, then run \`npm test\`.
5. Green: commit, have a reviewer subagent check the diff, fix any blockers, run \`npm test\` again, then push to \`main\`. Red: write the attempt and the reason under Tried in \`.ai/task.md\`, then discard the unit's uncommitted changes.
6. Repeat 4-5 with the next unit while your context is under ~50% full.
7. Then run the handoff (.ai/method.md section 9.1), commit it, push it to \`main\`, and stop.`;

/** Fills `{{name}}`-style placeholders and normalises the ending. */
export function buildRunPrompt(promptText: string, vars: Readonly<Record<string, string>>): string {
  return `${fillPlaceholders(promptText, vars).trim()}\n`;
}

export interface ClaudeArgsOptions {
  /** Pass `--dangerously-skip-permissions`. Off by default: the user must opt in on the command line. */
  skipPermissions: boolean;
  model?: string;
}

/** Argument array for `claude`; the prompt is a single argv entry, never part of a shell string. */
export function buildClaudeArgs(prompt: string, options: ClaudeArgsOptions): string[] {
  return [
    '-p',
    prompt,
    ...(options.model ? ['--model', options.model] : []),
    ...(options.skipPermissions ? ['--dangerously-skip-permissions'] : ['--permission-mode', 'acceptEdits']),
  ];
}
