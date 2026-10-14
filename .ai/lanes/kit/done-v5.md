# Kit lane: DONE (round 5, 0.5.0 "Cockpit")

## Built
- Round 5 audit (`.ai/audit/kit.md`).
- Four lane templates in `templates/lanes/`: `lane-run.md`, `control-run.md`, `schedule.json` (`lanes: {}`, missing entry = due), `steer.md`.
- Thin runner prompts (`runners/routine/*`, CLAUDE.md template): step 0 stays, the rest points to `.ai/lane-run.md`. Method ch. 16.
- Tests in `tests/unit/kit/round5-rules.test.ts`: every prompt/template has the not-due skip, steer step, run-log step and stale-clone step.

## Test results
`npm test` on origin/main (run 2): check, typecheck, unit, build green; e2e 156 passed, 30 skipped.

## Unsure / open
- `loop init --lanes` does not yet write the four templates (core's `src/cli`; asked in kit outbox 2026-10-13 02:00). The "writes four templates in a temp repo" done-when item depends on it; the test belongs to core.

## Next improvements (by value)
1. Core's `init --lanes` hook plus a temp-repo test.
2. A `loop doctor` check that a repo's `.ai/lane-run.md` matches the template version.
3. Template version marker so `loop upgrade` can refresh lane-run.md.
4. Windows task-scheduler runner using the thin prompt.
5. Plugin command `/loop-steer` wrapping `loop steer`.
6. Runner prompt for a "review only" lane.
7. Sample steer.md entries in the template as comments.
8. Idle-backoff helper in runners (call `loop schedule update`).
9. Cron examples for 5 lanes staggered by minute.
10. Template for `.ai/PAUSED` explanation in the CLAUDE.md section.
