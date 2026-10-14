# Lane: core — round 6 (0.6.0 "Memory + proof")

Run: 1 / 20
Status: in progress (units 1-3 done; next: unit 4)
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

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.
- Run `loop eval --runner claude` or call any model for an eval: tests use the fake runner.

## Handoff
Units 1-3 done (audit; recipes incl. draft; triggers, `loop hook`, `loop triggers stats`, `--triggers` on `loop runs log`). Next: unit 4, `loop init --hooks` (writes starter `.ai/triggers.yaml` + project `.claude/settings.json` hooks running `loop hook <event>`; template for triggers is kit's, add to FALLBACK like other templates, check `src/core/init.ts` + `src/cli/init.ts`), and `loop init` offering seed recipes `match` ranks above zero (kit's seeds in `templates/recipes/` may not exist yet: check). Then unit 5 (eval). Read first: IDEA.md Round 6 B4, C. Shipped for others: outbox 01:22 (loop hook).
