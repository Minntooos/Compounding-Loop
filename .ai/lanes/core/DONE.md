# core lane: DONE (round 6, 0.6.0 "Memory + proof")

## Built
- Recipes: parser/linter, store (`.ai/recipes/`, `~/.ai/recipes/`, `LOOP_HOME`), matcher, `loop recipe list|show|match|check|add|draft`.
- Triggers: `src/core/triggers.ts`, `loop hook <event>` (exit 0 always, 2,000-char cap, once per session, no network), `.ai/.trigger-log.jsonl`, `loop triggers stats`.
- `loop init --hooks` (triggers.yaml + `.claude/settings.json`), `loop init` offers fitting seed recipes, `--recipes` installs them.
- Eval: `loop eval run` (cold / recipe / recipe+triggers arms, `verify/` overlay, `recipeFile`), `loop eval report`; fake runner never saves results.
- `next-round --brief` dogfood fixes; `yaml` moved to `dependencies` (packed install crashed without it).

## Results
- `npm test` green on the fresh pull (run 3): unit, typecheck, build, 263 e2e pass.
- Packed-tarball check by hand (`npm pack`, install in empty dir): `loop init --hooks --force` writes triggers.yaml + settings.json; init offers both seed recipes; `loop init --recipes` then `recipe match build a static calculator site` ranks static-calculator-site first (score 3); `loop eval run --runner fake --task calc-page` passes both arms (from a copy of `evals/`); `loop hook PostToolUseFailure` exits 0.

## Unsure / owner's call
- `evals/` is not in package.json `files`, so an installed package has no eval tasks (CLAUDE.md lists the published folders).
- Dogfood (a lane run with `triggers` > 0 in runs.jsonl): not observed in the cloud sandbox; unknown whether it loads `.claude/settings.json` hooks.

## 10 next improvements (by value to users)
1. Ship `evals/` (or a `loop eval init` that scaffolds a task) so installs can run evals.
2. `loop recipe match` auto-offered at session start via the plugin.
3. Recipe pass/fail counters updated automatically from eval results.
4. `loop triggers stats` pruning suggestions for never-firing triggers.
5. Real-runner eval cost estimate before `--runner claude`.
6. `loop recipe draft` from a finished task's log automatically.
7. Eval report export as markdown for the README.
8. Trigger dry-run (`loop hook --explain`) showing why one matched.
9. Windows path coverage in hook command generation tests.
10. `loop doctor` check that hooks in settings.json point at an existing binary.
