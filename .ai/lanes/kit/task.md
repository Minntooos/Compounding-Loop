# Lane: kit — round 5 (0.5.0 "Cockpit")

Run: 0 / 20
Status: not started
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

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns (a fix to a red `main` is the one exception; say so in your outbox).
- Change the Operating Card, the version, `.ai/lane-run.md` or `.ai/control-run.md`; publish, tag or dispatch `release.yml`.

## Handoff
Not started. Read IDEA.md's Round 5 section and `.ai/lane-run.md`, then do unit 1.
