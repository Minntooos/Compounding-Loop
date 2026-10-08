# Lane: kit — round 2 (0.2.0 "Lanes")

Run: 1 / 20
Status: in progress (units 1-3 done; 4 next: lanes.yml)
Round 1 record: `.ai/lanes/kit/done-v1.md` (`git show 3385cdf:.ai/lanes/kit/task.md` for its Decisions).

## Contract
**Goal:** everything a user's repo needs to run lanes unattended: templates, runner prompts and the method chapter. It must be as good as what built this repo, made generic (IDEA.md "Round 2", must-haves 2 (templates) and 4).
**Done when:**
- `npm test` passes, and `.ai/audit/kit.md` exists with no open blocker.
- `templates/lanes/`: lane `task.md`, `outbox.md`, `control-room.md`, a `CLAUDE.md` lanes section (lane table + talking-to-other-lanes + `Lane:` trailer rule + per-lane unattended rules), and a CI snippet that runs `loop check-lanes`. Placeholders are documented and tested (`tests/unit/kit/`), so a template never ships an unfilled `{{x}}`.
- `runners/routine/lane-prompt.md` and `runners/routine/control-room-prompt.md`, generalised from the real prompts in `.ai/reference/routines/`. Keep what made them work: the multi-unit 40-minute run, the reviewer before every push, pull/rebase rules, the stop files and the never-list. Drop everything specific to this repo. The README explains staggered cron for N lanes with an example for 3 and for 5.
- `runners/github-actions/lanes.yml`: a matrix with one job per lane, `max-parallel: 1`, `concurrency: loop-lane-${{ matrix.lane }}`, `timeout-minutes`, `persist-credentials: false` unless the job pushes (document why it does), and secrets only by name. Tested by a unit test that parses the YAML.
- `method/COMPOUNDING_LOOP.md` gets a "Lanes" chapter in Part B (when to split into lanes and when not, ownership, outboxes, control room, the trailer check, and failure modes seen here: stale sandbox clones, rate-limit starvation, a lane waiting on a finished lane). **Do not change Part A (the Operating Card).**
**Constraints:** templates stay agent-neutral where possible (`AGENTS.md` mirrors `CLAUDE.md`). Never copy this repo's owner-specific text (names, repo URLs, routine IDs) into templates.
**Out of scope:** CLI code (core), new site templates.

## Units, in order
1. **Audit** (`.ai/audit/kit.md`):
   - Run `loop new static-site x --dry-run` and `loop new chrome-extension y --dry-run`, then their own `npm install && npm test`.
   - Read every template file as a first-time user would.
   - Check the routine prompt against what actually worked in `.ai/reference/routines/`.
   - Check that plugin commands load: run `/plugin marketplace add` against the repo layout, or verify the manifest schema.
   - Missing icons (chrome-extension), stale wording, Windows runner XML.
   Fix blockers.
2. `templates/lanes/` + placeholder tests. Tell core in your outbox (it writes them in `loop init --lanes`).
3. `runners/routine/lane-prompt.md` + `control-room-prompt.md` + README.
4. `runners/github-actions/lanes.yml` + test.
5. Method chapter "Lanes".
6. Majors from your audit, then round 1 leftovers by value: chrome-extension icons, a macOS launchd plist, and more example knowledge entries.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.
- Change the Operating Card (Part A), `version`, or publish.

## Handoff
Round 2 starts here. Commits carry a `Lane: kit` trailer (CLAUDE.md).
