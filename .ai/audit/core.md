# Audit: core (round 2, 2026-10-08)

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
