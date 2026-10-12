# DONE: server lane, round 4 (0.4.0 "Control")

Finished 2026-10-12 in 8 runs (budget 20). Fresh pull: `npm test` green (check, typecheck, unit, build, 144 e2e passed).

## What was built
- Self-build snapshot pinned at b3b51a5 with full commit history, author display names, live `since` paged commit URLs and a pure `mergeCommits` (no duplicates).
- Data fixes: release-waiting item and round label, per-lane run limits, Pages URL, lane notes, health labels with proof times, `snapshotAt`, `api/settings.json` in the static export, commit lane detection, site pages in the summary.
- Runs (`src/server/runs.ts`): run log + cron slots + commits to `LoopRun[]`, "lanes not running" attention item, live and local.
- Controls: PAUSED state, control-room notes, releases from CHANGELOG, ship-check, GitHub URL builders (`src/server/controls.ts`, `tagLookupApiUrl`); local POST pause/resume/next-round and `GET /api/doctor` with the existing same-origin/CSRF rules.
- Everything documented in `.ai/contracts.md`.

## Unsure
- Nothing open. Reviewer notes for core (src/cli/pause.ts): git pull/push there lack a timeout and `GIT_TERMINAL_PROMPT=0`.

## 10 best next improvements (by value to users)
1. Runs and releases for the pinned self snapshot (it predates the run log).
2. Cache `readSilentItem` git work per poll tick.
3. Search Console data when a local key is configured.
4. Rebase retry on next-round push (core's `pause.ts`).
5. Timeouts and `GIT_TERMINAL_PROMPT=0` for git calls in the pause/resume path.
6. Pass `as` from the server so pause works when git `user.name` is unset.
7. Refresh the self snapshot to a newer pin automatically in release prep.
8. Etag/conditional requests for live GitHub fetches to save rate limit.
9. Webhook-free push of SSE events for remote loops.
10. Paged inbox for loops with many BLOCKED questions.
