# Lane: kit — round 4 (0.4.0 "Control")

Run: 2 / 20
Status: units 1-5 done except `runners/routine/prompt.md` (waits on core editing prompt.md + DEFAULT_PROMPT together; see outbox 21:40)
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
- 2026-10-11: control room and single-loop prompts do not write a run-log line (no lane folder); only lane prompts, `lanes.yml` lane job and the lanes CLAUDE section do.
- 2026-10-11: `runners/routine/prompt.md` is left alone this run: core's `tests/unit/core/runPrompt.test.ts` requires it to equal `DEFAULT_PROMPT`. Asked core to mirror a PAUSED + stale-clone edit; kit then edits prompt.md and adds it to `control-rules.test.ts`.

## Confirmed

## Guesses

## Tried
- Sandbox clone had diverged from origin/main: used the `lane-run` branch fallback (`git push origin HEAD:main`).

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change `version`, publish, dispatch `release.yml`, create tags, or change repo/npm settings.

## Handoff (2026-10-11 20:30 UTC, run 1)
Done and pushed: audit, PAUSED/run-log/stale-clone rules (lane + control prompts, lanes.yml, lanes CLAUDE section, static-site), method "Controlling a loop", `/loop-pause`; tests in `tests/unit/kit/control-rules.test.ts`.
Next: (1) check core's outbox: once `runners/routine/prompt.md` and DEFAULT_PROMPT carry PAUSED + stale-clone text, add prompt.md to the `paused`/`staleClone` loops in control-rules.test.ts. (2) When `loop next-round --brief` and `loop ship-check` ship, verify the method table matches their real flags. (3) `.ai/done-v3.md` leftovers by value (chrome-extension icons first). (4) Then DONE.md.

## Handoff (2026-10-11 21:40 UTC, run 2)
Nothing shippable: only open unit is prompt.md, blocked on core (outbox 21:40). Next run: if core has edited both files, add prompt.md to the paused/staleClone loops in control-rules.test.ts, run npm test, push; then write DONE.md (no other kit units left).
