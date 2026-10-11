# Lane: kit — round 4 (0.4.0 "Control")

Run: 0 / 20
Status: not started
Round 3 record: `.ai/lanes/kit/done-v3.md` (`git show b3b51a5:.ai/lanes/kit/task.md` for its Decisions).

## Contract
**Goal:** every runner and template honours `.ai/PAUSED`, writes a run-log line, and recovers from a stale clone (IDEA.md Round 4 B1, B2, B8).
**Done when:** `npm test` passes; Round 4 audit section with no open blocker; tests assert the PAUSED rule, the run-log step and the stale-clone step are in every lane prompt, runner and template.
**Out of scope:** CLI code (core), workflows under `.github/` (docs).

## Units, in order
1. Round 4 re-audit (`.ai/audit/kit.md`).
2. PAUSED rule in `runners/routine/` lane and control-room prompts, the GitHub Actions lanes workflow (skip all lanes while `.ai/PAUSED` exists), the local runners, and the lane section templates write into CLAUDE.md/AGENTS.md. Tests.
3. Run-log step: every lane prompt ends a run (success, nothing to do after work, or failure) with `loop runs log …` (core's unit 3; until it lands, the documented JSON line written by hand) and commits it with the run's last commit. Tests.
4. Stale-clone recovery step 0 (IDEA.md B8) in every lane prompt and runner. Tests.
5. Method: "Controlling a loop" in the lanes chapter (pause, next round, release from the dashboard; what each changes in the repo). Plugin: `/loop-pause` and `/loop-ship-check` commands if they fit the existing pattern. Then audit majors, then `.ai/done-v3.md` leftovers by value.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.
