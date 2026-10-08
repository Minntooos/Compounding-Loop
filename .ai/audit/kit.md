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
