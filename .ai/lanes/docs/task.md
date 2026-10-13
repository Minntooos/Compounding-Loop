# Lane: docs — round 5 (0.5.0 "Cockpit")

Run: 0 / 20
Status: not started
Round 4 record: `.ai/lanes/docs/done-v4.md` (`git show 02874e8:.ai/lanes/docs/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** a stranger can steer and schedule a loop from the docs alone (IDEA.md Round 5 D).
**Owns (globs from `.ai/lanes.json`):** README.md, docs/**, launch/**, .github/**, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md, SECURITY.md, tests/unit/docs/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker.
- `docs/steering.md` exists, and the fresh-install test follows it word for word.
- `docs/dashboard.md` covers every new control and what it writes; README has "Glance, steer, sleep"; CHANGELOG `[Unreleased]` lists 0.5.0; screenshots under 400 kB each.
- The docs unit tests (links, commands named in docs exist in `loop --help`) pass.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** Code (core/server/web), templates (kit).

## Units, in order
1. Round 5 re-audit (`.ai/audit/docs.md`). Your first run is scheduled late (`.ai/schedule.json`), so that features exist to document.
2. `docs/steering.md` (IDEA.md D), with the exact thin routine prompt text from kit's templates.
3. `docs/dashboard.md` for every new control; README "Glance, steer, sleep"; CHANGELOG `[Unreleased]`.
4. Swap in web's new screenshots; `launch/` drafts mention steering and idle-for-free.
5. Audit majors, then minors. Write DONE only after web and core are DONE, so the docs match what shipped.
6. Pace in `docs/steering.md` and `docs/dashboard.md` (IDEA.md B7, C9).

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Not started. Read IDEA.md's Round 5 section and `.ai/lane-run.md`, then do unit 1.
