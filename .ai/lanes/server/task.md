# Lane: server — round 6 (0.6.0 "Memory + proof")

Run: 0 / 20
Status: not started
Round 5 record: `.ai/lanes/server/done-v5.md`.
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, pace from `.ai/policy.json`, run log, idle backoff).

## Contract
**Goal:** the data the Knowledge & recipes and Eval screens need, locally and in the static demo (IDEA.md Round 6 E1).
**Owns (globs from `.ai/lanes.json`):** src/server/**, demo/**, tests/unit/server/**
**Done when:**
- `npm test` passes.
- Round 6 audit section with no open blocker.
- Unit tests for `GET /api/loops/:id/knowledge`, `GET /api/recipes` (home paths shown as `~`, never absolute) and `GET /api/eval` (no results → empty, not an error); routes recorded in `.ai/contracts.md`.
- The demo snapshot has knowledge, trigger, recipe and eval fixtures; eval fixtures are marked `sample: true`.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files. Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** UI (web), parsing and commands (core: call them, don't copy them), recipe and eval content (kit).

## Units, in order
1. Round 6 re-audit (`.ai/audit/server.md`).
2. Demo fixtures first (web starts from them at 12:00 UTC): knowledge entries with trigger fired counts, two recipes, an eval report marked sample. Record the response shapes in `.ai/contracts.md` and tell web in your outbox.
3. Routes on top of core's functions as they land: knowledge, recipes, eval. Until core ships, read the files directly behind a small adapter and switch when core's exports exist.
4. Audit majors, then minors.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.
- Run `loop eval --runner claude` or call any model for an eval: tests use the fake runner.

## Handoff
<Rewritten at the end of every run: commit, whether the tree is clean, the single next step, what to read first. Name finished units as "units 1-3 done" so `loop next` can skip them, and list what you shipped that another lane waits on (also in your outbox).>
