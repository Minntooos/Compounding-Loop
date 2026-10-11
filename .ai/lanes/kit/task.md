# Lane: kit — round 3 (0.3.0 "Showcase")

Run: 4 / 20
Status: units 1-3 done; unit 4 started: plugin /loop-lanes shipped (done-v2 improvement 7). Next: more done-v2 leftovers (control-room job in lanes.yml, lane-aware handoff/retro templates)
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
Run 4: systemd user service+timer shipped (runners/local, tested; reviewer fixes PATH, linger, 85min). Note: the sandbox clone had an unrelated stale history; reset to origin/main. Remaining done-v2 leftovers: lane-aware handoff/retro templates in method/, app-with-lanes template.
