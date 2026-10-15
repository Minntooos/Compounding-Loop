# Round 6 (0.6.0 "Memory + proof"): DONE

Checked by the control room on 2026-10-15 (UTC), against the Round 6 "done when" list in IDEA.md.

## What was built
- **core:** recipe parser/linter/matcher and `loop recipe` (list, show, match, check, add, draft), trigger parser and `loop hook`, `loop triggers stats`, `loop init --hooks/--recipes`, `loop eval run|report`.
- **kit:** objective line in three places, two seed recipes, three eval tasks (calc-page, cli-json, known-trap), plugin hooks, this repo's `.claude/settings.json` hooks.
- **server:** knowledge, recipes and eval endpoints, demo fixtures.
- **web:** Knowledge & recipes tab and Eval view with headline and empty states.
- **docs:** docs/memory.md, docs/eval.md, README section, CHANGELOG, launch placeholders.

## Results
- `npm test` (check, typecheck, unit, build, e2e) passes on a fresh clone of origin/main: 277 e2e passed, 75 skipped (other-project/viewport skips), 0 failed.
- Leak check: `npm pack --dry-run` lists nothing from `.ai/`, `IDEA.md`, root `CLAUDE.md`, `tests/` or reference data (only the template files under `templates/`). No secrets or owner email in the repo.
- Fresh install from a packed tarball in an empty temp dir:
  - `loop init --hooks --force` wrote `.ai/triggers.yaml` and `.claude/settings.json`.
  - After `loop init --recipes`, `loop recipe match "add a mortgage calculator page"` in a copy of `evals/calc-page/repo` ranked R-static-calculator-site first (score 2, tag match).
  - `loop eval run --runner fake --task calc-page` passed (cold and recipe).
  - `loop hook PostToolUseFailure` with a sample stdin and a matching trigger printed the exact `hookSpecificOutput` JSON, exit 0.
- Dogfood: kit's run line records `triggers: 1`.
- Never ran a real eval.

## Open or unsure
- Minor, web: no screenshots reviewed visually for the new tabs (axe, scroll and console are tested). Two loaders show while both queries load.
- Lane runs after the owner's steer skipped the full test run; the control room's run above is the full check.
- `loop recipe match` with no task text and no installed recipes finds nothing; recipes need `loop init --recipes` first. `loop init` refuses a thin IDEA.md unless `--force`. Both are documented behaviour, but worth a line in the quick start.
- `loop check-lanes` over history still reports old failures (control commits touching release files, an unowned fixture from core); not new this round.

## Owner's release checklist
1. In your local Claude Code: bump `version` to 0.6.0, finalise CHANGELOG, run `npm test`.
2. Run the real eval locally (`loop eval run --runner claude`) and record the headline.
3. Publish after you approve; tag `v0.6.0`.
4. Post the drafts in `launch/` yourself.
