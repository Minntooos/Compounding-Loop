// Triggers (IDEA.md Round 6 B): `.ai/triggers.yaml` entries that fire at the moment they matter. Pure and browser-safe.
import { parse as parseYaml } from 'yaml';
import { matchGlob } from './lanes.js';

export const TRIGGERS_FILE = '.ai/triggers.yaml';
export const TRIGGER_LOG_FILE = '.ai/.trigger-log.jsonl';
/** All injected text of one hook call together. */
export const INJECT_CAP = 2000;
/** The part of a knowledge entry a trigger injects. */
export const ENTRY_CAP = 1200;

export const TRIGGER_KINDS = ['error', 'file', 'command', 'topic'] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

export interface TriggerEntry {
  id: string;
  on: TriggerKind;
  /** One pattern, or several (any may match). */
  match: string[];
  /** Text, or a repo-relative path to a knowledge entry. */
  inject: string;
}

export interface ParsedTriggers {
  triggers: TriggerEntry[];
  /** One message per entry that was skipped, with the fix. */
  problems: string[];
}

/** Reads `.ai/triggers.yaml`; bad entries are skipped and reported, never thrown. */
export function parseTriggers(text: string): ParsedTriggers {
  const out: ParsedTriggers = { triggers: [], problems: [] };
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (error) {
    out.problems.push(`triggers.yaml is not valid YAML: ${(error as Error).message.split('\n')[0]}`);
    return out;
  }
  if (raw === null || raw === undefined) return out;
  if (!Array.isArray(raw)) {
    out.problems.push('triggers.yaml must be a list of entries, each starting with "- id:".');
    return out;
  }
  const seen = new Set<string>();
  raw.forEach((item: unknown, i) => {
    const at = `entry ${i + 1}`;
    const e = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : undefined;
    const id = e && typeof e.id === 'string' ? e.id : undefined;
    const label = id ?? at;
    const matches = e ? (Array.isArray(e.match) ? e.match : [e.match]).filter((m): m is string => typeof m === 'string' && m !== '') : [];
    if (!e || !id) out.problems.push(`${at} has no "id". Add one, e.g. K-0042.`);
    else if (!(TRIGGER_KINDS as readonly unknown[]).includes(e.on)) out.problems.push(`${label}: "on" must be one of ${TRIGGER_KINDS.join(', ')}.`);
    else if (matches.length === 0) out.problems.push(`${label}: "match" is empty. Give a string or a list of strings.`);
    else if (typeof e.inject !== 'string' || !e.inject.trim()) out.problems.push(`${label}: "inject" is empty. Give text or a path to a knowledge entry.`);
    else if (seen.has(id)) out.problems.push(`${label}: duplicate id. Ids must be unique.`);
    else {
      seen.add(id);
      out.triggers.push({ id, on: e.on as TriggerKind, match: matches, inject: e.inject });
    }
  });
  return out;
}

/** `/pattern/` or `/pattern/i` is a regex; undefined if it is not that form or does not compile. */
function asRegExp(pattern: string): RegExp | undefined {
  const m = /^\/(.+)\/([a-z]*)$/s.exec(pattern);
  if (!m) return undefined;
  try {
    return new RegExp(m[1] ?? '', m[2]?.replace(/[^imsu]/g, ''));
  } catch {
    return undefined;
  }
}

const posix = (p: string): string => p.replace(/\\/g, '/').replace(/^\.\//, '');

/** Does one pattern match this value for this kind? error: substring or regex; file: glob; command: prefix or regex; topic: keyword in the prompt. */
export function matches(kind: TriggerKind, pattern: string, value: string): boolean {
  const re = asRegExp(pattern);
  if (re) return re.test(value);
  switch (kind) {
    case 'error': return value.toLowerCase().includes(pattern.toLowerCase());
    case 'file': return matchGlob(posix(pattern), posix(value));
    case 'command': return value.trimStart().startsWith(pattern);
    case 'topic': return value.toLowerCase().includes(pattern.toLowerCase());
  }
}

/** What a Claude Code hook call tells us, reduced to what matching needs. */
export interface HookFacts {
  event: string;
  sessionId: string;
  /** Failed tool output (PostToolUseFailure). */
  error?: string;
  /** Path a tool reads or edits, repo-relative with forward slashes. */
  file?: string;
  /** A Bash command, before it runs. */
  command?: string;
  /** The user's prompt. */
  prompt?: string;
}

/** Which trigger kinds each hook event may fire (IDEA.md B2). */
export const EVENT_KINDS: Record<string, readonly TriggerKind[]> = {
  PostToolUseFailure: ['error', 'file'],
  PostToolUse: ['file'],
  PreToolUse: ['command'],
  UserPromptSubmit: ['topic'],
};

const valueFor = (kind: TriggerKind, facts: HookFacts): string | undefined => ({ error: facts.error, file: facts.file, command: facts.command, topic: facts.prompt })[kind];

/** Triggers that fire for this event, in file order, minus ids already injected in this session. */
export function matchTriggers(triggers: readonly TriggerEntry[], facts: HookFacts, alreadyFired: ReadonlySet<string> = new Set()): TriggerEntry[] {
  const kinds = EVENT_KINDS[facts.event] ?? [];
  return triggers.filter((t) => {
    if (alreadyFired.has(t.id) || !kinds.includes(t.on)) return false;
    const value = valueFor(t.on, facts);
    return value !== undefined && value !== '' && t.match.some((p) => matches(t.on, p, value));
  });
}

/** The `hookSpecificOutput` object Claude Code reads from stdout; undefined when there is nothing to say. Text is capped as a whole. */
export function hookOutput(event: string, texts: readonly string[]): { hookSpecificOutput: { hookEventName: string; additionalContext: string } } | undefined {
  const joined = texts.map((t) => t.trim()).filter(Boolean).join('\n\n');
  if (!joined) return undefined;
  const additionalContext = joined.length <= INJECT_CAP ? joined : `${joined.slice(0, INJECT_CAP - 1)}…`;
  return { hookSpecificOutput: { hookEventName: event, additionalContext } };
}

/** Text of a knowledge entry to inject: front matter dropped, first 1,200 characters. */
export function entryText(entry: string): string {
  const body = entry.replace(/^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '').trim();
  return body.length <= ENTRY_CAP ? body : `${body.slice(0, ENTRY_CAP - 1)}…`;
}

/** A trigger's `inject` is a path (ends in .md, no spaces) or literal text. */
export const injectPath = (inject: string): string | undefined => (/^[^\s]+\.md$/.test(inject.trim()) ? inject.trim() : undefined);

export interface FireRecord {
  at: string;
  session: string;
  id: string;
  event: string;
}

/** Parses `.ai/.trigger-log.jsonl`; broken lines are skipped. */
export function parseTriggerLog(text: string): FireRecord[] {
  const out: FireRecord[] = [];
  for (const line of text.split(/\r?\n/)) {
    try {
      const v = JSON.parse(line) as Record<string, unknown>;
      if (v && typeof v.at === 'string' && typeof v.session === 'string' && typeof v.id === 'string' && typeof v.event === 'string') out.push({ at: v.at, session: v.session, id: v.id, event: v.event });
    } catch {
      // skip
    }
  }
  return out;
}

export interface TriggerStat {
  id: string;
  fired: number;
  lastFired?: string;
  /** False for ids in the log that are no longer in triggers.yaml. */
  defined: boolean;
}

/** Fired counts per id: every defined trigger (0 if never), then ids only the log knows. Most fired first. */
export function triggerStats(triggers: readonly TriggerEntry[], log: readonly FireRecord[]): TriggerStat[] {
  const stats = new Map<string, TriggerStat>(triggers.map((t) => [t.id, { id: t.id, fired: 0, defined: true }]));
  for (const r of log) {
    const s = stats.get(r.id) ?? { id: r.id, fired: 0, defined: false };
    s.fired++;
    if (!s.lastFired || r.at > s.lastFired) s.lastFired = r.at;
    stats.set(r.id, s);
  }
  return [...stats.values()].sort((a, b) => b.fired - a.fired || a.id.localeCompare(b.id));
}
