# core lane: DONE (round 5, 0.5.0 "Cockpit")

## Built
- Browser-safe parsers in `src/core/parse/**`: schedule (`parseSchedule`, `isDue`, `applyBackoff`, `wakeReasons`), steer (`parseSteer`, `formatSteerEntry`), `classifyRunSlots`, policy (`parsePolicy`, `paceFor`, `policyProblem`).
- CLI: `loop schedule show|pause|resume|snooze|wake|update`, `loop steer`, `loop pace show|set`, `loop next-round --draft [--out] [--print-prompt]`; `loop init --lanes` / `loop lanes add` write lane-run.md, control-run.md, schedule.json, steer.md and policy.json.
- `lintBrief` understands round briefs; rounds are counted from the brief (A5); phantom run slots replaced (A2).

## Tests
Final run 5: `npm test` green (check, typecheck, unit, build, e2e: 184 passed, 58 skipped).

## Unsure
- `lintBrief` is generous with junk lettered sections (minor a).
- kit's policy template may drift from the built-in fallback.
- tests/unit/kit/chrome-extension.test.ts is slow under full-suite load.

## Next 10 improvements (by user value)
1. Stricter `lintBrief` vague-section check.
2. Single source for lane templates (kit files vs FALLBACK_LANE_TEMPLATES).
3. `loop doctor` check for corrupt schedule.json/steer.md.
4. `loop schedule` clearer push-failure message.
5. `loop runs --json` outcome summary for scripts.
6. Windows `claude.cmd` shim support in `loop run`.
7. `loop steer --edit` to amend an unacknowledged entry.
8. `loop check-lanes` friendly message on empty repos.
9. Per-lane pace explanation in `loop pace show`.
10. Speed up the slow chrome-extension test.
