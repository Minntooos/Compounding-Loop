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
| 1 | Stray `.` in the status table's name column for the current folder | major | show the folder's basename (`src/core/status.ts`) |
| 2 | `loop new` deletes the folder when gh fails | major | keep it, print a resume hint |
| 3 | `answer` commits but does not push | major | `--push` flag |
