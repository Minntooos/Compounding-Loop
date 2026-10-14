// `loop init --hooks`: the starter triggers file and the project `.claude/settings.json` hooks (IDEA.md Round 6 B4). Pure.
export const SETTINGS_FILE = '.claude/settings.json';

export const HOOK_EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure'] as const;
/** Built-in tools only: additionalContext is dropped for MCP and Agent tool calls. */
export const TOOL_MATCHER = 'Bash|Read|Edit|Write|Glob|Grep';
const TOOL_EVENTS: readonly string[] = ['PreToolUse', 'PostToolUse', 'PostToolUseFailure'];
export const HOOK_TIMEOUT_SECONDS = 5;

export const STARTER_TRIGGERS = `# Triggers: a lesson that fires at the moment it matters (see .ai/method.md, C.5).
# Each entry: id, on (error | file | command | topic), match (text, /regex/ or a list), inject (text, or a path to a knowledge entry).
# A hook runs \`loop hook <event>\`; \`loop triggers stats\` shows how often each one fired.
# - id: K-0001
#   on: error
#   match: "fetch is not a function"
#   inject: .ai/knowledge/K-0001.md
`;

export interface HookEntry {
  type: 'command';
  command: string;
  timeout: number;
}

const entryFor = (event: string, command: string) => ({
  ...(TOOL_EVENTS.includes(event) && { matcher: TOOL_MATCHER }),
  hooks: [{ type: 'command', command: `${command} ${event}`, timeout: HOOK_TIMEOUT_SECONDS } satisfies HookEntry],
});

export interface MergedSettings {
  /** Undefined when the existing file cannot be read as JSON: nothing is written then. */
  content?: string;
  /** Events that got a new hook; empty when every event already runs `loop hook`. */
  added: string[];
  error?: string;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const runsLoopHook = (group: unknown): boolean =>
  isObject(group) && Array.isArray(group.hooks) && group.hooks.some((h) => isObject(h) && typeof h.command === 'string' && /\bhook\s+\w+\s*$/.test(h.command) && /loop(\.js)?\s/.test(h.command));

/**
 * Adds a `loop hook <event>` command for each of the five events to a settings.json text, keeping every other setting and hook.
 * An event that already runs `loop hook` is left alone, so re-running changes nothing. `command` is `loop hook`-style, without the event.
 */
export function mergeHookSettings(existing: string | undefined, command = 'loop hook'): MergedSettings {
  let settings: Record<string, unknown> = {};
  if (existing !== undefined && existing.trim() !== '') {
    try {
      const parsed: unknown = JSON.parse(existing);
      if (!isObject(parsed)) return { added: [], error: `${SETTINGS_FILE} must be a JSON object; fix or remove it, then re-run.` };
      settings = parsed;
    } catch {
      return { added: [], error: `${SETTINGS_FILE} is not valid JSON; fix or remove it, then re-run.` };
    }
  }
  if (settings.hooks !== undefined && !isObject(settings.hooks)) return { added: [], error: `"hooks" in ${SETTINGS_FILE} must be an object; fix it, then re-run.` };
  const hooks: Record<string, unknown> = { ...(settings.hooks as Record<string, unknown> | undefined) };
  const added: string[] = [];
  for (const event of HOOK_EVENTS) {
    const groups = hooks[event];
    if (groups !== undefined && !Array.isArray(groups)) return { added: [], error: `hooks.${event} in ${SETTINGS_FILE} must be a list; fix it, then re-run.` };
    if (groups?.some(runsLoopHook)) continue;
    hooks[event] = [...(groups ?? []), entryFor(event, command)];
    added.push(event);
  }
  return { content: `${JSON.stringify({ ...settings, hooks }, null, 2)}\n`, added };
}
