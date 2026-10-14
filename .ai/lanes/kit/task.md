# Lane: kit — round 6 (0.6.0 "Memory + proof")

Run: 1 / 20
Status: in progress (units 1-3 done in run 1)
Round 5 record: `.ai/lanes/kit/done-v5.md`.
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, pace from `.ai/policy.json`, run log, idle backoff).

## Contract
**Goal:** the recipe format and seeds, the eval tasks, the hook wiring (plugin and this repo), and the method rewritten around the new objective (IDEA.md Round 6 A1, A5, A6, B4, B5, C1, D).
**Owns (globs from `.ai/lanes.json`):** method/**, templates/**, runners/**, plugin/**, evals/**, .claude/**, tests/unit/kit/**
**Done when:**
- `npm test` passes.
- Round 6 audit section with no open blocker.
- The Round 6 "done when" kit-tests line passes: `plugin/hooks/hooks.json` valid and runs `loop hook`; this repo's `.claude/settings.json` hook commands exist; both seed recipes pass `loop recipe check`; every eval task fails on its fixture and passes with its solution; the objective line is identical in method, templates and `CLAUDE.md`.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files. Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** parsing, matching and CLI code (core), API (server), UI (web), docs pages (docs).

## Units, in order
1. Round 6 re-audit (`.ai/audit/kit.md`).
2. D: method rewrite (§1 objective word for word from IDEA.md D, §2 Experience row, §7 recipe layer, §8 exact hook events, §12 recipe step, §13 tokens per verified unit + eval) and the templates' Operating Card objective line; the identical-objective test.
3. A1 + A5: `templates/recipe.md` (the format) and the two seed recipes (`templates/recipes/static-calculator-site.md` from the five sites in `.ai/reference/`, `templates/recipes/cli-command-json.md` from this repo), each under 6 KB. A6: retro step in method §12 and `plugin/commands/retro.md`. Until core's parser lands, test the front matter with the `yaml` package directly.
4. C1: `evals/calc-page`, `evals/cli-json`, `evals/known-trap`, each with `task.md`, a zero-dependency `repo/`, `eval.json` (check command, recipe id), `solution/`; the test that the check fails on the fixture and passes with the solution.
5. B4: `plugin/hooks/hooks.json` (five events, built-in tool matchers, `loop hook <event>`).
6. B5 (only after core says `loop hook` is on `main` and green): this repo's `.claude/settings.json` (`node bin/loop.js hook <event>`, 5 s timeout) and a seeded `.ai/triggers.yaml` (K-0001, K-0002 and the traps listed in IDEA.md B5). Check the hook on a sample stdin before pushing: a broken hook would hit every lane.
7. Audit majors, then minors.

## Decisions
- Objective wording is CLAUDE.md's (owner's) "owner's attention" in all places, including the method's Part A (was "human's"); the test compares the lines byte for byte.
- Seed recipes use `stack: node@20` only, so they match the zero-dependency eval fixtures (engines.node) as well as real projects.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.
- Run `loop eval --runner claude` or call any model for an eval: tests use the fake runner.

## Handoff
<Rewritten at the end of every run: commit, whether the tree is clean, the single next step, what to read first. Name finished units as "units 1-3 done" so `loop next` can skip them, and list what you shipped that another lane waits on (also in your outbox).>
