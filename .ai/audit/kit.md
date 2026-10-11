# Audit: kit (round 4, 2026-10-11)

Goal this round: every runner and template honours `.ai/PAUSED`, writes a run-log line and recovers from a stale clone (IDEA.md B1, B2, B8).

## Blockers
None open.

## Findings
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Lane prompt, control-room prompt, `lanes.yml` prompts, lanes CLAUDE section and static-site prompt/CLAUDE.md had no PAUSED rule | major | fixed (`tests/unit/kit/control-rules.test.ts`) |
| 2 | Lane prompt, `lanes.yml` lane job and lanes CLAUDE section did not end a run with a `runs.jsonl` line | major | fixed; control room and single-loop prompts have no lane folder, so they log nothing (decision) |
| 3 | No stale-clone recovery anywhere; a diverged cached clone made a run blame a force-push | major | fixed in all of the above, with "check `git log origin/main` first" |
| 4 | `runners/routine/prompt.md` (single loop) lacks the PAUSED and stale-clone steps | major | blocked: `src/core/runPrompt.ts` DEFAULT_PROMPT must equal it (core test); asked core in outbox |
| 5 | Method has no "Controlling a loop" section; plugin has no `/loop-pause` | minor | unit 5 |

# Audit: kit (round 3, 2026-10-11)

Goal this round: every runner and template honours claims; the method explains working with a teammate.

## Blockers
None open.

## Findings
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Lane prompt, `lanes.yml` prompt and the templates' CLAUDE.md lane section ignored `.ai/lanes/<lane>/claim` | major | fixed: all three stand down on an unexpired claim by someone else; tests assert it |
| 2 | Method has no "Working with teammates" section | major | unit 3 |
| 3 | Plugin has no `/loop-next` command | minor | unit 3, after core's `loop next` lands |
| 4 | Single-loop prompts (`prompt.md`, static-site `loop-prompt.md`) have no lanes, so no claim rule | minor | none needed |

# Audit: kit (round 2, 2026-10-08)

## Blockers
None open. Fixed: the session-lock step in `runners/routine/prompt.md` and `templates/static-site/.ai/loop-prompt.md` would make every `loop run` stand down ("Nothing to do"), because `loop run` writes the lock itself (core outbox, 20:25). Both now say the runner's own lock does not count. Gitignores use `**/session.lock` so lane locks are covered.

## Checklist
| Item | Result |
|---|---|
| `loop new static-site x --dry-run`, then `npm install && npm test` | pass: 3 passed, 0 failed |
| `loop new chrome-extension y --dry-run`, then `npm install && npm test` | pass: 2 passed, 0 failed |
| Template files read as a first-time user | pass; wording current, no unfilled placeholders beyond `{{name}}` (documented and replaced) |
| Routine prompt vs `.ai/reference/routines/` | pass on structure (40-minute multi-unit run, reviewer before push, rebase rule, stop files, never-list); lock wording fixed above |
| Plugin loads | pass by schema: `.claude-plugin/marketplace.json` -> `./plugin`, `plugin.json` has name/version, four commands with `description` front matter |
| Windows runner XML | pass: valid task schema, `loop.cmd`, 90-minute limit, `IgnoreNew`; path placeholder is documented |
| Chrome-extension icons | gap: manifest has no `icons`; needed for the Web Store (unit 6) |

## Findings
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | Prompt stood down on the runner's own lock | blocker | fixed |
| 2 | Chrome extension has no icons | minor | unit 6 |
| 3 | No macOS launchd example | minor | unit 6 |
| 4 | GitHub Actions `loop.yml` has no per-lane form | major | unit 4 (`lanes.yml`) |
