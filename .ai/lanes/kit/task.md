# Lane: kit — round 5 (0.5.0 "Cockpit")

Run: 2 / 20
Status: units 1-4 done except the `loop init --lanes` hook (core)
Round 4 record: `.ai/lanes/kit/done-v4.md` (`git show 02874e8:.ai/lanes/kit/task.md` for its Decisions).
How a run works: `.ai/lane-run.md` (cheap stop checks, steering, run log, idle backoff).

## Contract
**Goal:** every new user gets the round 5 run model: thin prompts, `.ai/lane-run.md`, `.ai/control-run.md`, `.ai/schedule.json` and `steer.md` (IDEA.md Round 5 B5).
**Owns (globs from `.ai/lanes.json`):** method/**, templates/**, runners/**, plugin/**, tests/unit/kit/**
**Done when:**
- `npm test` passes.
- Round 5 audit section with no open blocker.
- `loop init --lanes` in an empty temp repo writes the four new templates (test).
- Tests assert every runner prompt and template contains the cheap not-due skip, the steer step, the run-log step and the stale-clone step.
**Constraints:** edit only the paths you own, plus the smallest edit to shared files (CLAUDE.md "Lanes"). Read anything. Unacknowledged `next-run` entries in `steer.md` come before this list.
**Out of scope:** CLI code (core; ask in your outbox for the `loop init --lanes` hook), UI, docs pages (docs).

## Units, in order
1. Round 5 re-audit (`.ai/audit/kit.md`).
2. Templates for `.ai/lane-run.md` and `.ai/control-run.md` (generalised from this repo's own files: no repo names, `<lane>` placeholders), `.ai/schedule.json` (every lane due) and `.ai/lanes/<lane>/steer.md`. Ask core in your outbox to have `loop init --lanes` write them.
3. Thin runner prompts: `runners/routine/*` and the CLAUDE.md template say "follow `.ai/lane-run.md`" and keep step 0 (pull, stale clone) in the prompt. Method §16: "thin prompts, schedule, steering".
4. The template tests named in Done when. Then write DONE: this lane is small this round on purpose.

## Decisions
- 2026-10-13: `schedule.json` template is `lanes: {}` (missing entry = due per lane-run.md step 1), so core needs no per-lane fill. Only the lane/control prompts changed; single-loop `runners/routine/prompt.md` stays (core test keeps it equal to DEFAULT_PROMPT).

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Run 1: units 1-4 done (audit, four templates in templates/lanes/, thin prompts, tests in tests/unit/kit/round5-rules.test.ts, method ch. 16). Open: core must write the templates in `loop init --lanes` (asked in outbox 2026-10-13 02:00). Next run: if core shipped it, add a kit test that runs it in a temp repo is core's; then review outboxes and write DONE.md. If core has not, write DONE.md anyway listing it.
