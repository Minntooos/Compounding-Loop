# Lane: kit — round 3 (0.3.0 "Showcase")

Run: 1 / 20
Status: units 1-3 done (audit, claim rule in prompts/templates, method section, plugin /loop-next). Next: unit 4
Round 2 record: `.ai/lanes/kit/done-v2.md` (`git show 084bb9f:.ai/lanes/kit/task.md` for its Decisions).

## Contract
**Goal:** every runner and template honours claims, and the method explains working with a teammate (IDEA.md Round 3 must-have 5).
**Done when:** `npm test` passes; Round 3 audit section with no open blocker; tests assert the claim rule is in every lane prompt and template.
**Out of scope:** CLI code (core), docs site pages (docs).

## Units, in order
1. Round 3 re-audit (`.ai/audit/kit.md`).
2. Claim rule in `runners/routine/` lane prompt, the GitHub Actions lanes workflow (skip a lane whose claim names someone else and has not expired), the local runners, and the lane section the templates write into CLAUDE.md/AGENTS.md. Tests.
3. Method: a "Working with teammates" section in the lanes chapter (clone, `loop next`, claim, run, release; nothing private is handed over; `.ai/` is the shared memory). Plugin: a `/loop-next` command if it fits the plugin's existing pattern.
4. Audit majors, then round 2 leftovers in `.ai/done-v2.md` by value.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Run 1 shipped units 1-3. Unit 4 next: audit has no open majors; take round 2 leftovers in `.ai/done-v2.md` (kit section) by value. Open request to core in outbox: pass the claimant name into `loop run --lane` and add the claim rule to runPrompt.ts.
Round 3 starts here. Brief: IDEA.md "Round 3". Commits carry a `Lane: kit` trailer.
