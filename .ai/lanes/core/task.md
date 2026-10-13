# Lane: core — round 5 (0.5.0 "Cockpit")

Run: 3 / 20
Status: in progress (units 1-6 and 8 done; unit 7 minors left)
Round 4 record: `.ai/lanes/core/done-v4.md` (`git show 02874e8:.ai/lanes/core/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** the browser-safe logic and CLI commands behind steering, scheduling and run outcomes (IDEA.md Round 5 A2, A5, A9, B1-B4).
**Owns (globs from `.ai/lanes.json`):** src/core/**, src/cli/**, bin/**, tests/unit/core/**, tests/unit/cli/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker.
- A2, A5 and A9 each have a regression test that fails before the fix; `lintBrief` scores the Round 5 brief at least 85.
- Unit tests cover `loop schedule` (every action, backoff and wake rules, `--json`, `--no-commit`), `loop steer`, the schedule and steer parsers, `classifyRunSlots` (every outcome) and `next-round --draft --print-prompt` (no Claude call in tests).
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** UI (web), templates and runner prompts (kit), HTTP routes and GitHub/npm fetching (server).

## Units, in order
1. Round 5 re-audit (`.ai/audit/core.md`).
2. Browser-safe schedule (`parseSchedule`, `isDue(entry, now)`, `applyBackoff(runs, entry, now)`, `wakeReasons(...)`) and steer (`parseSteer`, `formatSteerEntry`, acknowledgement state) parsers in `src/core/parse/**`, plus types in `src/core/types.ts` (additive). Tell server and web in your outbox as soon as they are on main: they build on them.
3. `loop schedule show|pause|resume|snooze|wake|update` and `loop steer` (IDEA.md B1-B2), committing with `Lane: control` (`--no-commit`). After this, lanes stop applying the backoff by hand; say so in your outbox.
4. `classifyRunSlots(lanes, runs, schedule, paused, doneFiles, now)` (B3) replaces the phantom-slot logic (A2): no expected slots after root DONE, while PAUSED, for done/blocked or not-due lanes, and one "routines look off" state after 6 h of silence. Use it in `loop runs`.
5. `lintBrief` understands round briefs (A9). Fix A5 (count rounds from the brief or headings, not from `done-vN.md` names) where the parser lives.
6. `loop next-round --draft [--out] [--print-prompt]` (B4) through the existing `runPrompt`; the prompt builder is a pure, tested function.
7. Audit majors, then minors.
8. Pace (IDEA.md B7): browser-safe `parsePolicy` + `paceFor(lane)`, `loop pace show|set`, and `loop init --lanes` writes `.ai/policy.json` (ask kit for the template text; until kit wakes, use `{"version":1,"pace":"balanced","lanes":{}}`).

## Decisions
- `applyBackoff` leaves the entry unchanged when the newest run had units (no invented wake-up) and never touches a paused entry. `wakeReasons` takes pre-parsed messages `{at,to[]}` so outbox and control-room notes share it.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Run 1 shipped units 1-6: audit; schedule/steer parsers + CLI (`src/cli/schedule.ts`); `classifyRunSlots` (`src/core/parse/outcomes.ts`); `lintBrief` round briefs + `countRounds`; `loop next-round --draft [--out] [--print-prompt]` (`src/core/draftBrief.ts`, `src/cli/draft.ts`; `--out` confined to new .md files inside the repo). Next: unit 7. Known open minors: (a) `lintBrief` is generous with junk lettered sections (a `### A. stuff` with three short items scores 80; consider stricter vague check); (b) DONE (check-lanes allows `.ai/schedule.json` for any lane); (c) `loop schedule` push failure message names the pull; (d) tests/unit/kit/chrome-extension.test.ts is flaky under full-suite load (32 s). Then DONE per CLAUDE.md "Lane finished" if the contract holds (done-when: all tests listed in contract exist).
Notes: `schedule update --lane X` is what lanes run at step 8. Sandbox: origin main may not fast-forward; use branch `lane-run`, push `origin HEAD:main`.
Run 2: `loop init --lanes` / `loop lanes add` now write lane-run.md, control-run.md, schedule.json and per-lane steer.md (loop state, never overwritten; kit's 02:00 ask). Web's formatSteerEntry/prompt-builder/parseSchedule/classifyRunSlots asks were already exported from src/core/parse. Remaining: unit 7 minors, then DONE.

Run 3: unit 8 (Pace) shipped: `src/core/parse/policy.ts` (parsePolicy, paceFor, withPace, formatPolicy, PACE_SUMMARY), `src/cli/pace.ts` (`loop pace show|set [--lane]`), `loop init --lanes` writes `.ai/policy.json` from a built-in default (no kit template exists). Reviewer nits left: corrupt policy.json silently reads as balanced; kit template could drift from FALLBACK_LANE_TEMPLATES.policy. Remaining: unit 7 minors, then DONE.
