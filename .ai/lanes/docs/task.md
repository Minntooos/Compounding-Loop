# Lane: docs — round 6 (0.6.0 "Memory + proof")

Run: 1 / 20
Status: DONE (units 1-5 done, run 1)
Round 5 record: `.ai/lanes/docs/done-v5.md`.
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, pace from `.ai/policy.json`, run log, idle backoff).

## Contract
**Goal:** `docs/memory.md`, `docs/eval.md`, the README section, CHANGELOG and launch drafts for round 6 (IDEA.md Round 6 F).
**Owns (globs from `.ai/lanes.json`):** README.md, docs/**, launch/**, .github/**, CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md, SECURITY.md, tests/unit/docs/**
**Done when:**
- `npm test` passes.
- Round 6 audit section with no open blocker.
- `docs/memory.md` and `docs/eval.md` exist and every command in them runs as written in a fresh temp repo (test, using `--runner fake` for the eval).
- README has the "Learn once, one-shot the next" section with `<!-- eval: pending -->` where the number goes; launch drafts use the same placeholder; CHANGELOG `[Unreleased]` lists round 6.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files. Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** code (core, server, web), templates and method (kit).

## Units, in order
1. Round 6 re-audit (`.ai/audit/docs.md`).
2. `docs/memory.md`: recipes (format, store, match, draft, check), triggers (`.ai/triggers.yaml`, the five hook events, plugin vs `.claude/settings.json`), cleanup.
3. `docs/eval.md`: tasks, arms, running it, reading the report; local models through Ollama (variables from IDEA.md Research, marked as unverified until the owner's run), hardware honesty.
4. README section, CHANGELOG, launch drafts with the placeholder.
5. Audit majors, then minors.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, or publish anything.
- Run `loop eval --runner claude` or call any model for an eval: tests use the fake runner.

## Handoff
Lane DONE: nothing left. Tree clean after push. Only follow-up is swapping the eval placeholders once the owner has a real result. (old note: <Rewritten at the end of every run: commit, whether the tree is clean, the single next step, what to read first. Name finished units as "units 1-3 done" so `loop next` can skip them, and list what you shipped that another lane waits on (also in your outbox).>
