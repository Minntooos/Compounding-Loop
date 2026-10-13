# Lane: server — round 5 (0.5.0 "Cockpit")

Run: 0 / 20
Status: not started
Round 4 record: `.ai/lanes/server/done-v4.md` (`git show 02874e8:.ai/lanes/server/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** the data and write API the cockpit needs, locally and in the static demo (IDEA.md Round 5 A1, A7, B6).
**Owns (globs from `.ai/lanes.json`):** src/server/**, demo/**, tests/unit/server/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker.
- A1 and A7 have regression tests that fail before the fix.
- Unit tests for every new route (schedule, steer, schedule actions, draft-brief SSE with a fake `claude`, npm state) and for the GitHub prefill URL builders; routes recorded in `.ai/contracts.md`.
- The demo snapshot has run-log, schedule, steer and release fixtures that exercise every outcome web shows.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** UI (web), parsing and commands (core: call them, don't copy them), templates (kit).

## Units, in order
1. Round 5 re-audit (`.ai/audit/server.md`).
2. A1: release shipped detection (tag exists + npm `latest` when reachable; `registry.npmjs.org` allows CORS, add it to the static CSP `connect-src`) and npm state per version for Releases. A7: local fleet cards get the same CI, tests and domain fields as the demo.
3. Demo snapshot fixtures: runs.jsonl lines covering worked/idle/limit-stop, a `schedule.json` with a sleeping and a snoozed lane, `steer.md` with acknowledged and open entries. Web was blocked on missing fixtures in round 4; tell web in your outbox when they land.
4. Routes (B6) on top of core's commands as they land: `GET …/schedule`, `POST …/steer`, `POST …/schedule`, run outcomes from `classifyRunSlots`. Static demo: pure prefilled-GitHub-URL builders for steer and schedule edits.
5. `POST …/draft-brief`: SSE progress from `next-round --draft`, ending with the draft and its score; a fake `claude` in tests.
6. Audit majors, then minors.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Not started. Read IDEA.md's Round 5 section and `.ai/lane-run.md`, then do unit 1.
