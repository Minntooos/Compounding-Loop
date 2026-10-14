# Lane: core — round 6 (0.6.0 "Memory + proof")

Run: 3 / 20
Status: DONE (see DONE.md)
Round 5 record: `.ai/lanes/core/done-v5.md`.
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, pace from `.ai/policy.json`, run log, idle backoff).

## Contract
**Goal:** the recipe store and matcher, the trigger engine with `loop hook`, and the eval runner (IDEA.md Round 6 A2-A4, B1-B3, C2-C4).
**Owns (globs from `.ai/lanes.json`):** src/core/**, src/cli/**, bin/**, tests/unit/core/**, tests/unit/cli/**
**Done when:**
- `npm test` passes.
- Round 6 audit section with no open blocker.
- Unit tests for every item in the Round 6 "done when" unit-test line (recipes, triggers, `loop hook`, `loop triggers stats`, `loop eval run --runner fake`, `loop eval report`).
- `loop init --hooks` writes `.ai/triggers.yaml` and `.claude/settings.json` (test in an empty temp repo).
**Constraints:** edit only the paths you own, plus the smallest edit to shared files. Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** templates, recipe and eval *content* and the plugin (kit), API routes (server), UI (web).

## Units, in order
1. Round 6 re-audit (`.ai/audit/core.md`).
2. Recipes (A2-A4): parser + linter (`check`), store (`.ai/recipes/`, `~/.ai/recipes/`, `LOOP_HOME`), matcher (stack from `package.json` at major version, tags, task text), `loop recipe list|show --context|match|check|add`, then `loop recipe draft --print-prompt` (same pattern as `next-round --draft`). Ship the parser first and tell kit in your outbox: kit's seed recipes and tests wait on it.
3. Triggers (B1-B3): `src/core/triggers.ts`, `loop hook <event>` (exact `hookSpecificOutput` shape; exit 0 on any error; 2,000-character cap; once per `session_id`; no network), `.ai/.trigger-log.jsonl` (add to `.gitignore`), `loop triggers stats`, optional `triggers` count in `loop runs log`. Tell kit when `loop hook` is on `main` and green: kit wires this repo's hooks only after that.
4. `loop init --hooks`: starter `.ai/triggers.yaml` and project `.claude/settings.json` hooks; `loop init` offers seed recipes that `match` ranks above zero.
5. Eval (C2-C4): `loop eval run` (temp dir copy, `git init`, `claude -p --output-format json --max-turns 30`, restricted tools, `--env-file`, recipe arm prepends `recipe show --context`, then the task's check), results jsonl, `loop eval report` (table + headline; no results, no headline). Fake runner + recorded JSON fixture in tests.
6. Audit majors, then minors. Dogfood findings from the owner's setup (2026-10-14): `next-round --brief` writes task files with unfilled `<placeholders>` and a duplicate `---` before the old round in IDEA.md, and inserts the control-room note in the middle of the file. Fix if small.

## Decisions
- Recipe score: +1 per stack item with the same major, -1 per name with another major, +1 per tag whose words all appear in the task text; score <= 0 drops out; ties by passes then id. Reason string "stack 3/4, major differs: x, tags: a, b".
- `loop recipe show` accepts the id with or without `R-`. Drafts (`*.draft.md`) are never listed or matched.
- `check` with no file lints the project store, drafts included (so a draft shows its score before a human renames it).

- Fake runner results are never saved (model `fake`, `--runner fake` skips `evals/results/`) so the report can only ever show real runs. `loop eval report` reads every `evals/results/*.jsonl`.
- Task format accepted: `eval.json` `{check, recipe}` or plain files `check` and `recipe`; `recipe+triggers` arm needs `evals/<id>/triggers.yaml` (+ optional `knowledge/`).

## Confirmed
- `yaml` was a devDependency but `src/core/triggers.ts` and `recipes.ts` import it at runtime, so a packed install crashed with ERR_MODULE_NOT_FOUND (found by the tarball smoke test in run 1). Moved to `dependencies` (reason: the CLI parses front matter and triggers.yaml); `tests/unit/core/dependencies.test.ts` now guards this for every package.

- Eval `verify/` is overlaid into the temp copy after the agent run and before the check; `recipeFile` (inside the task folder only) feeds the recipe arm. Done in run 2 for kit's outbox request. `evals/` not in package.json `files`: needs owner's call (CLAUDE.md lists published folders), not changed.

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.
- Run `loop eval --runner claude` or call any model for an eval: tests use the fake runner.

## Handoff
Run 2: eval verify overlay + recipeFile shipped; all 3 kit tasks pass with `--runner fake`. Remaining: packed-tarball check (needs `evals/` shipped, owner's call), then DONE.md.
Units 1-6 done. Nothing else open in the core contract except verifying with kit's content: when `templates/recipes/*.md` and `evals/<task>/` are on main, run the packed-tarball done-when by hand (`npm pack`, install in an empty temp dir, `loop init --hooks`, `loop recipe match` in a copy of `evals/calc-page/repo` ranks static-calculator-site first, `loop eval run --runner fake --task calc-page`, `loop hook PostToolUseFailure` with sample stdin) and fix what breaks. Also: the dogfood requirement (a lane run with `triggers` > 0 in runs.jsonl) needs kit's `.claude/settings.json`; note in the log if the cloud sandbox does not load it. Then retro, read outboxes, write `.ai/lanes/core/DONE.md` (10 next improvements). Read first: outboxes of kit and server.
