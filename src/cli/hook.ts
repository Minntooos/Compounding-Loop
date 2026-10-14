import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { entryText, hookOutput, injectPath, matchTriggers, parseTriggerLog, parseTriggers, triggerStats, EVENT_KINDS, TRIGGERS_FILE, TRIGGER_LOG_FILE, type TriggerStat } from '../core/triggers.js';
import { matchHere } from './recipe.js';

const read = (file: string) => readFile(file, 'utf8').catch(() => undefined);

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

/** Repo-relative, forward-slash path of what a tool reads or edits; undefined when it is outside the repo. */
function relativeFile(dir: string, file: string | undefined): string | undefined {
  if (!file) return undefined;
  const rel = path.relative(dir, path.resolve(dir, file)).split(path.sep).join('/');
  return rel.startsWith('..') || path.isAbsolute(rel) ? undefined : rel;
}

/** The text a trigger injects: literal, or the first 1,200 characters of the knowledge entry it points at (inside the repo only). */
async function injectedText(dir: string, inject: string): Promise<string | undefined> {
  const rel = injectPath(inject);
  if (!rel) return inject;
  const abs = path.resolve(dir, rel);
  if (path.relative(dir, abs).startsWith('..')) return undefined;
  const text = await read(abs);
  return text === undefined ? undefined : entryText(text);
}

/**
 * `loop hook <event>`: stdin is Claude Code's hook JSON; the return value is what to print on stdout ('' for nothing).
 * No network and no model call. Throws only on bugs; the CLI wrapper turns any throw into "print nothing, exit 0".
 */
export async function runHook(event: string, stdin: string, dir: string): Promise<string> {
  if (event !== 'SessionStart' && !(event in EVENT_KINDS)) return '';
  const input = JSON.parse(stdin || '{}') as Record<string, unknown>;
  const session = str(input.session_id) ?? 'no-session';
  const toolInput = (input.tool_input && typeof input.tool_input === 'object' ? input.tool_input : {}) as Record<string, unknown>;
  const logFile = path.join(dir, ...TRIGGER_LOG_FILE.split('/'));
  const fired = new Set(parseTriggerLog((await read(logFile)) ?? '').filter((r) => r.session === session).map((r) => r.id));

  const texts: string[] = [];
  const ids: string[] = [];
  if (event === 'SessionStart') {
    const best = (await matchHere(dir, '', 1))[0];
    if (best && !fired.has(best.id)) {
      texts.push(`Recipe for this repo: ${best.id} (${best.reason}). Run \`loop recipe show ${best.id} --context\` for its steps and checks.`);
      ids.push(best.id);
    }
  } else {
    const { triggers } = parseTriggers((await read(path.join(dir, ...TRIGGERS_FILE.split('/')))) ?? '');
    const tool = str(input.tool_name);
    const matched = matchTriggers(triggers, {
      event,
      sessionId: session,
      // PostToolUseFailure carries the failure text in `error`; some versions put it in the tool response.
      ...(event === 'PostToolUseFailure' && { error: [str(input.error), str(input.tool_response)].filter(Boolean).join('\n') }),
      ...(event !== 'UserPromptSubmit' && { file: relativeFile(dir, str(toolInput.file_path) ?? str(toolInput.path)) }),
      ...(event === 'PreToolUse' && tool === 'Bash' && { command: str(toolInput.command) }),
      ...(event === 'UserPromptSubmit' && { prompt: str(input.prompt) }),
    }, fired);
    for (const t of matched) {
      const text = await injectedText(dir, t.inject);
      if (text) {
        texts.push(text);
        ids.push(t.id);
      }
    }
  }
  const out = hookOutput(event, texts);
  if (!out) return '';
  await mkdir(path.dirname(logFile), { recursive: true });
  const at = new Date().toISOString();
  await appendFile(logFile, ids.map((id) => `${JSON.stringify({ at, session, id, event })}\n`).join(''));
  return JSON.stringify(out);
}

export interface TriggersReport {
  stats: TriggerStat[];
  total: number;
  /** Set when triggers.yaml had entries that were skipped. */
  problems: string[];
}

/** `loop triggers stats`: fired counts per id from `.ai/.trigger-log.jsonl`. */
export async function triggersStats(dir: string): Promise<TriggersReport> {
  const { triggers, problems } = parseTriggers((await read(path.join(dir, ...TRIGGERS_FILE.split('/')))) ?? '');
  const log = parseTriggerLog((await read(path.join(dir, ...TRIGGER_LOG_FILE.split('/')))) ?? '');
  return { stats: triggerStats(triggers, log), total: log.length, problems };
}

export function formatTriggersReport(report: TriggersReport): string {
  if (report.stats.length === 0) return 'No triggers yet. Add entries to .ai/triggers.yaml (or run `loop init --hooks`).';
  const lines = report.stats.map((s) => `${s.id.padEnd(12)} fired ${String(s.fired).padStart(3)}  ${s.lastFired ? `last ${s.lastFired}` : 'never'}${s.defined ? '' : '  (not in triggers.yaml)'}`);
  lines.push(`${report.total} fires in total.`, ...report.problems.map((p) => `warning: ${p}`));
  return lines.join('\n');
}
