# Kit lane: DONE (round 6, 0.6.0 "Memory + proof")

## Built
- Method rewritten around the new objective (§1, §2, §7 recipes, §8 hook events, §12 recipe step, §13 tokens per verified unit); identical objective line in CLAUDE.md, method, card and templates (tested).
- `templates/recipe.md` and two seed recipes (`static-calculator-site`, `cli-command-json`), retro command in the plugin.
- `evals/calc-page`, `evals/cli-json`, `evals/known-trap` (task, zero-dependency repo, verify, solution, eval.json).
- `plugin/hooks/hooks.json` (five events) and this repo's `.claude/settings.json` plus a seeded `.ai/triggers.yaml`.

## Tests
`npm test` green: 263 e2e passed, unit all passed. Kit tests include `runEval` with the fake runner over `evals/` (every task fails with no change, passes with its solution; no model call).

## Unsure
- `evals/` is not in `package.json` `files`; shipping it is the owner's call.
- Seed recipes have `uses`/`passes` at 0: no measured track record until a real eval is run by the owner.

## Next improvements (by value)
1. Run the real eval (owner) and publish the cold vs recipe vs recipe+triggers numbers.
2. More seed recipes (Vite+React app, Python CLI, Next static export).
3. More eval tasks, including two more known traps.
4. Ship `evals/` in the package behind an opt-in `loop init --evals`.
5. Recipe decay: flag recipes whose stack majors drift.
6. Trigger stats feedback: retire triggers that never fire.
7. Plugin: a `/recipe` command wrapping `loop recipe match`.
8. Hook latency budget test (under 1 s).
9. Windows-specific hook command variants in `plugin/hooks`.
10. Eval fixtures for the lanes templates.
