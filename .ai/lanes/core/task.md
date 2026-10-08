# Lane: core — round 2 (0.2.0 "Lanes")

Run: 1 / 20
Status: in progress
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

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (`.ai/lanes.json`), except for the "main stays green" fix.
- Change `version` in package.json or publish.

## Handoff
Round 2 starts here. Commits carry a `Lane: core` trailer (CLAUDE.md).
