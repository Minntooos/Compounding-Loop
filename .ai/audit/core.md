# Audit: core

## Round 5 (2026-10-13)

Goal judged: schedule, steering, run outcomes and brief scoring as browser-safe pure functions plus the CLI commands that write them.

| # | Finding | Severity | Fix |
|---|---|---|---|
| R5-1 | No schedule or steer parser; lanes apply the idle backoff by hand | blocker for server/web | FIXED (run 1): `parseSchedule`, `isDue`, `notDueReason`, `applyBackoff`, `wakeReasons`, `parseSteer`, `addSteerEntry` in `src/core/parse/` |
| R5-2 | `expectedSlots`/`matchSlots` expect runs after root DONE, while PAUSED and for lanes not due (167 phantom slots, A2) | blocker | FIXED (verified by control room 2026-10-13: shipped, tests green; table was stale) |
| R5-3 | `lintBrief` misses `### Round N done when`, `**Out of scope:**` and bold lead-ins; scores this IDEA.md 25/100 (A9) | blocker | FIXED (verified by control room 2026-10-13: shipped, tests green; table was stale) |
| R5-4 | Round count from `done-vN.md` names counts handoff notes (A5, `src/core/rounds.ts`) | major | FIXED (verified by control room 2026-10-13: shipped, tests green; table was stale) |
| R5-5 | No `loop schedule` / `loop steer` / `next-round --draft` | major | FIXED (verified by control room 2026-10-13: shipped, tests green; table was stale) |

## Round 4 (2026-10-11)

Goal judged: repo state the dashboard reads (PAUSED, run log, ship-check, next-round, CHANGELOG, commit author) and the commands behind its buttons.

| # | Finding | Severity | Fix |
|---|---|---|---|
| R4-1 | No `.ai/PAUSED`: owner switches routines on and off one by one | blocker for web/kit | FIXED: `loop pause/resume`, browser-safe `parsePaused`/`isPaused`, `StopMarkers.paused`, `loop run` and `loop status` honour it |
| R4-2 | Runs leave no record: a skipped or limit-hit run is invisible | blocker for web/server | FIXED: `loop runs log` / `loop runs [--json]`, browser-safe `parseRunLog`, `expectedSlots`, `matchSlots`, `missedInARow` |
| R4-3 | `loop next-round` is single-loop only | major | FIXED: `--brief <file> [--dry-run] [--json] [--no-commit]` (src/core/laneRound.ts pure plan, src/cli/laneRound.ts applies) |
| R4-4 | `check-lanes` has no `release`/`control` path rules | major | FIXED: `Lane: release` may touch package.json, lockfile, plugin.json, CHANGELOG.md; `Lane: control` .ai/**, IDEA.md, DONE.md |
| R4-5 | `LoopCommit` has no author, control-room notes not parsed per lane | major | FIXED: `author?` on LoopCommit, `latestControlNotes`, `commitLane` (parse/controlRoom.ts) |

## Round 3 (2026-10-11)

Goal judged: browser-safe parsers for the live demo, then `loop claim/release/next` for teams.

| # | Finding | Severity | Fix |
|---|---|---|---|
| R3-1 | Parsers the browser needs were scattered: `parseRunCounter` lived in `repo.ts` (imports `node:`), there was no task-file, stop-marker or claim parser | blocker for server/web | FIXED: `src/core/parse/` entry point (task, markers, re-exports of lanes/trailer/outbox), a test fails on any `node:` import there |
| R3-2 | `claude` child may outlive the parent after SIGKILL; stale lock lasts 90 min | minor | FIXED: lock holds the pid, a dead holder makes the lock stale at once |
| R3-3 | `.ai/last-test.json` still has no writer, so the dashboard shows "Tests: no result" | major | FIXED upstream: the kit templates' `scripts/test.mjs` write it; nothing more to build in `loop run` |

---

## Round 2 (2026-10-08)

## Blockers
None open. Fixed: `npm test` was red on a fresh checkout because check 7 (docs vs `--help`) ran `bin/loop.js` before `build` created `dist/`; it now runs the CLI from source (`scripts/check.mjs`).

## Checklist
| Item | Result |
|---|---|
| `--help` accurate and consistent for init, new, run, status, next-round, answer, dashboard | pass: read all seven; every flag in help exists, wording matches |
| Error messages say how to fix | partial: init/new/run do; to re-check during unit 8 |
| Exit codes | pass: failures set `process.exitCode = 1` |
| `npx compounding-loop@0.1.0` cold start | not measured yet (needs network) |
| Windows quoting and paths | pass by construction: `execFile` arrays and `node:path`; lanes.ts normalises `\` |
| No gh / no claude / offline / dirty repo | not yet re-tested; `loop doctor` (unit 5) covers detection |
| Round 1 gaps: stray dot in status, folder deleted when gh fails, `answer` not pushing | open, unit 8 |

## Findings
| # | Finding | Severity | Fix |
|---|---|---|---|
| 1 | The idle icon `.` looked like a stray dot in the status table | major | FIXED: idle is now `-` (`src/core/table.ts`) |
| 2 | `loop new` deleted the folder when gh fails | major | FIXED: folder kept, message prints `gh repo create <name> --private --source . --push` |
| 3 | `answer` committed but did not push | major | FIXED: `--push` (a failed push exits 1 and says what to run) |
| 4 | `loop run` never wrote `.ai/session.lock` | major | FIXED: `loop run [--lane]` writes/clears it, also on failure, Ctrl-C, SIGTERM, SIGHUP |
| 5 | `npm test` red on a fresh checkout (check 7 needed `dist/`) | blocker | FIXED |
| 6 | Not covered by a test: SIGKILL / terminal crash leaves a stale lock (expires after 90 min by design); the `claude` child may outlive the parent on Ctrl-C | minor | open |
| 7 | `.ai/last-test.json` is still not written by anything | minor | open (needs a decision with server on who runs the tests) |
