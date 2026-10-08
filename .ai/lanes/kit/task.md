# Lane: kit

Run: 0 / 30
Status: not started

## Contract
**Goal:** the method, templates, runners and Claude Code plugin that `loop init`/`loop new` install (IDEA.md must-haves 8–16).
**Done when:**
- `npm test` passes; `tests/unit/kit/*.test.ts` check every rule below with a file-level assertion.
- `method/` holds the generic method: `COMPOUNDING_LOOP.md`, `operating-card.md` (under 60 lines; a test counts them), `task-template.md` (goal, done-when, Confirmed vs Guess, Tried, Decisions, `Run: N / 30`), `knowledge-index.md` plus an example triggered entry, reviewer prompt, stuck protocol, retro.
- `templates/static-site/`: the proven starter made generic (no niche words; placeholders like `{{name}}`, `{{domain}}`). A test copies it to a temp dir, fills the placeholders and runs its `check` (its full `npm test` as a slow test).
- `templates/chrome-extension/`: MV3 manifest, a popup page, a check script and a Playwright extension test; its own tests pass in a temp copy (skip with a clear message only when Chromium is unavailable).
- `runners/github-actions/loop.yml` (scheduled, `anthropics/claude-code-action`, documents the `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` secret and never stores one; a test parses the YAML), `runners/routine/prompt.md` with placeholders plus `runners/routine/README.md` (staggered cron), `runners/local/` (crontab line plus a Windows Task Scheduler XML).
- `plugin/`: a valid Claude Code plugin (`.claude-plugin/plugin.json`, `commands/loop-init.md`, `handoff.md`, `retro.md`, `stuck.md`). A test parses the JSON and checks every command file has frontmatter with a description. The repo-root `.claude-plugin/marketplace.json` is owned by docs: ask in your outbox.
- Session lock (90 min), run budget (30) and DONE/BLOCKED rules are stated identically in method, routine prompt and template (a test greps for the same numbers).
**Constraints:** original text; the method may be adapted from `method/COMPOUNDING_LOOP.md` (same author). No secrets. Cross-platform paths.
**Out of scope:** CLI code (core), dashboard (web).

## Units, in order
1. `method/operating-card.md` + `method/task-template.md` + tests. Core needs these for `loop init`: post in your outbox when shipped.
2. Generalise `templates/static-site/` (remove niche specifics, add placeholders, keep its tests working).
3. `runners/routine/prompt.md` (generalised from this repo's lane prompt, which the control room can show you in `.ai/reference/` if added) + README.
4. `runners/github-actions/loop.yml` + `runners/local/`.
5. `plugin/` commands.
6. `templates/chrome-extension/`.
7. Knowledge/trigger example, reviewer prompt and retro in `method/`.

## Decisions
(none yet: write "decision · reason · how to reverse")

## Confirmed
(facts proven by a command or test; cite path:line)

## Guesses
(unproven beliefs; never treat one as fact in a later run)

## Tried
(what failed and why, so the next run does not repeat it)

## Don't
- Edit paths another lane owns (CLAUDE.md lane table), except for the "main stays green" fix.
- Add a dependency without a Decisions entry.

## Handoff
(each run ends by writing: where it stopped, the exact next step, anything half-done)
