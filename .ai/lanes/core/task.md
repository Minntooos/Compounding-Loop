# Lane: core — round 5 (0.5.0 "Cockpit")

Run: 1 / 20
Status: in progress (units 1-4 done)
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

## Decisions
- `applyBackoff` leaves the entry unchanged when the newest run had units (no invented wake-up) and never touches a paused entry. `wakeReasons` takes pre-parsed messages `{at,to[]}` so outbox and control-room notes share it.

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Run 1 shipped units 1-4: audit; parsers (`src/core/parse/schedule.ts`, `steer.ts`); CLI `loop schedule ...` and `loop steer` (`src/cli/schedule.ts`); `classifyRunSlots`/`missedRun` (`src/core/parse/outcomes.ts`, used by `loop runs`; slots carry `kind`). Next: unit 5 `lintBrief` (src/core/brief.ts, A9: score IDEA.md Round 5 >= 85) and A5 rounds (src/core/rounds.ts), then unit 6 `next-round --draft [--out] [--print-prompt]` via `runPrompt`, then unit 7 (check-lanes: allow `.ai/schedule.json` for `Lane: <lane>` commits touching only its entry?).
Notes: `schedule update --lane X` is what lanes run at step 8 (commits `Lane: X`). A manual `wake` stays until the lane logs a run. server's `src/server/runs.ts` still has its own slot logic; outbox tells server to adopt classifyRunSlots. Sandbox: origin main may not fast-forward; use branch `lane-run`, push `origin HEAD:main`.
