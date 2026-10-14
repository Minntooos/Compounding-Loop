# Lane: web — round 6 (0.6.0 "Memory + proof")

Run: 0 / 20
Status: not started
Round 5 record: `.ai/lanes/web/done-v5.md`.
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, pace from `.ai/policy.json`, run log, idle backoff).

## Contract
**Goal:** the Knowledge & recipes screen and the Eval view (IDEA.md Round 6 E2).
**Owns (globs from `.ai/lanes.json`):** web/**, tests/e2e/**, tests/unit/web/**
**Done when:**
- `npm test` passes.
- Round 6 audit section with no open blocker.
- e2e with the demo data: Knowledge & recipes (index entries, trigger badges, recipe cards, copy-context button), the Eval table and headline, the sample marking, the empty states; axe clean in both themes at 1440 and 375 px; no horizontal scroll at 375 px; zero console errors.
- Independent design review verdict recorded per unit in `.ai/audit/web.md`.
- JS bundle under 300 kB gzip.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files. Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** data and routes (server), parsing (core), docs pages (docs).

## Units, in order
1. Round 6 re-audit (`.ai/audit/web.md`).
2. Knowledge & recipes tab (replaces the empty Knowledge tab) from server's demo fixtures and `.ai/contracts.md`.
3. Eval view: table task × arm × model, the headline sentence, the visible **sample** marking on demo data, the empty state naming `loop eval run`.
4. Audit majors, then minors (round 5 leftovers in `done-v5.md` only if time remains).

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
