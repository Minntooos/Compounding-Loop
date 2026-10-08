# Lane: core — round 2 (0.2.0 "Lanes")

Run: 1 / 20
Status: in progress (units 2,3,4,5,6,7 done; next: finish audit majors = unit 8: stray dot in status, keep folder on gh failure, answer --push, last-test.json; then DONE if reviewer clean)
Round 1 record: `.ai/lanes/core/done-v1.md`; its Decisions still hold (`git show 3385cdf:.ai/lanes/core/task.md`).

## Contract
**Goal:** the CLI that makes lanes a one-command feature, plus a first-run experience with no rough edges (IDEA.md "Round 2", must-haves 1, 2, 3, 5, 6 (status part), 7).
**Done when:**
- `npm test` passes, and `.ai/audit/core.md` exists with no open blocker.
- `src/core/lanes.ts` (pure, no Node-only imports so web can use it): parse + validate `.ai/lanes.json`, match a path to its lane, and validate a commit's files against its `Lane:` trailer. Unit tests cover overlap rejection, shared globs, the lane's own `.ai/lanes/<name>/**`, and Windows-style paths.
- `loop init --lanes a,b,c` and `loop lanes add <name> --owns <glob>…` write the files listed in IDEA.md must-have 2 using kit's templates (`templates/lanes/`). Tests run in temp dirs: idempotent, and `--force` never clobbers task/outbox state (same rule as round 1's state files).
- `loop check-lanes [--range a..b]` uses `git log --format` + `git diff-tree --name-only` via `execFile`. A test repo built in a temp dir passes for good commits and fails, with a fix-it message, for a commit that crosses lanes.
- `loop run --lane <name>` uses kit's lane prompt and writes/clears `.ai/lanes/<name>/session.lock` (`.ai/session.lock` for single loops), including on failure and Ctrl-C. Tested without calling `claude` (inject the runner).
- `loop status` shows one row per lane for laned loops.
- `loop doctor`: node ≥ 20, git, gh + `gh auth status`, claude, Playwright Chromium. Each failure prints how to fix it, and the exit code is non-zero if anything required is missing. Tested with fake probes.
**Constraints:** round 1 rules (strict TS, pure core, `execFile` arrays, no network in tests). Glob matching: prefer a tiny dependency that's already installed (check `node_modules` for picomatch). If you add one, write it under Decisions. `path.matchesGlob` is not available on Node 20.
**Out of scope:** templates' contents (kit), server/web display (they read your `lanes.ts`).

## Units, in order
1. **Audit** (`.ai/audit/core.md`). Checklist:
   - every command's `--help` is accurate and consistent;
   - error messages say how to fix the problem;
   - exit codes;
   - `npx compounding-loop@0.1.0` cold start time;
   - Windows quoting and paths;
   - what happens without gh, without claude, offline, or with a dirty repo;
   - round 1's known gaps: the stray dot in status, a folder deleted when gh fails, `answer` not pushing.
   Fix blockers.
2. `src/core/lanes.ts` + tests. Tell server and web in your outbox (they display lanes).
3. `loop check-lanes` + tests. Ask docs (outbox) to add `node bin/loop.js check-lanes --range <base>..HEAD` to CI.
4. `loop init --lanes` / `loop lanes add` (needs kit's `templates/lanes/`; if it isn't there yet, do unit 5 first).
5. `loop doctor`.
6. `loop run --lane` + session lock writing.
7. `loop status` lanes rows.
8. Majors from your audit, then round 1 leftovers by value: `answer --push`, keep the folder on gh failure with a resume hint, `.ai/last-test.json` (coordinate with server).

## Decisions
- 2026-10-08: lane globs use a tiny in-house matcher in `src/core/lanes.ts` (`**`, `*`, `?`), not picomatch: picomatch is only a transitive dep and lanes.ts must stay browser-safe. Overlap detection compares each glob against a sample path of the other (catches nested prefixes; misses exotic pairs like `**/*.ts` vs `src/**`).
- 2026-10-08: `loop doctor` requires node>=20, git, claude; gh, gh auth and Chromium are 'missing' warnings only (they gate `loop new`/pushing/browser tests, not running a loop). Easy to flip in `src/core/doctor.ts`.
- 2026-10-08: check-lanes skips merge commits and a shallow clone's oldest commit (reports it); commits without trailer are reported, not failed.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (`.ai/lanes.json`), except for the "main stays green" fix.
- Change `version` in package.json or publish.

## Handoff
Run 1 (2026-10-08 20:08-20:40 UTC) shipped, all pushed to main and green: fresh-checkout `npm test` fix (check 7 runs from source); `src/core/lanes.ts`; `loop check-lanes`; `loop doctor`; `loop run --lane` + session lock (`src/cli/lock.ts`); `loop status` lane rows (`src/core/laneStatus.ts`, `src/cli/laneStatus.ts`, `LaneStatus` in types.ts); `loop init --lanes` / `loop lanes add` (`src/core/lanesInit.ts`, `src/cli/lanesInit.ts`, built-in fallbacks until kit ships `templates/lanes/`); `answer --push`; `loop new` keeps the folder on gh failure; idle icon `-`. Audit: `.ai/audit/core.md` (no open blocker).
Next: (1) check outboxes: kit's `templates/lanes/*` and prompt wording about the runner's own lock; server's use of `readLaneStatuses`; docs' CI line for check-lanes. (2) Remaining audit items: measure `npx compounding-loop@0.1.0` cold start (needs network), `.ai/last-test.json` writer (decide with server), wait for the `claude` child before releasing the lock on Ctrl-C, merge lane section into an existing AGENTS.md (currently only CLAUDE.md), case-insensitive glob matching on Windows/macOS, overlap detection for exotic globs. (3) If all contract items pass and the reviewer finds none, write DONE.md (10 next improvements).
