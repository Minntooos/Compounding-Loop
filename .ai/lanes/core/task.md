# Lane: core

Run: 1 / 30
Status: units 1-5 done (new has no @clack brief prompts yet) (init installs .ai/* + AGENTS.md; card waits on kit)

## Contract
**Goal:** the `loop` CLI and the pure logic in `src/core` that every other lane builds on (IDEA.md must-haves 1–7).
**Done when (every line is a command or test):**
- `npm test` passes.
- `tests/unit/core/*.test.ts` cover: status rules (done), brief linter, `.ai/` readers (task.md run counter, DONE/BLOCKED, done-vN count, session.lock), next-round rewriter, template copier.
- `tests/unit/cli/*.test.ts` run the built CLI (`node bin/loop.js …`) in temp dirs: `--help`, `init` (idempotent, `--force`), `new static-site demo-x --dry-run` (then that folder's own `npm test` passes; mark it as a slow test), `next-round`, `status`, `answer --dry-run`, `dashboard --demo --no-open` starts and `/api/health` answers.
- `loop run` builds the same prompt the routine uses (unit test on the prompt builder; tests never actually call `claude`).
**Constraints:** strict TS, pure functions in `src/core`, IO at the edges (`src/cli`). `execFile`/`spawn` with argument arrays only. No network or GitHub login in tests: `gh` calls go behind an interface with a fake.
**Out of scope:** HTTP server internals (server lane), template contents (kit lane).

## Units, in order
1. `src/core/repo.ts`: read a loop's facts from a folder (`LoopFacts` in types.ts) + tests with fixture folders made in a temp dir.
2. `src/core/brief.ts`: brief linter, score 0–100 with named gaps (IDEA.md #3) + tests with a good and a bad brief. The web lane imports it for the wizard, so keep it free of Node-only imports.
3. `loop init` (#1) with `--force`; installs kit's `method/` files and the Operating Card. If kit hasn't shipped the generic files yet, copy what exists and note it in your outbox.
4. `loop new <template> [name] --dry-run` (#2), and the real path through a `Gh` interface (`gh repo create --private`).
5. `loop next-round` (#5), `loop status` (#6), `loop answer` (#6).
6. `loop run` (#4): prompt builder that fills `runners/routine/prompt.md` placeholders.
7. `loop dashboard [--demo] [--port] [--no-open]` (#7): imports `startServer` from `src/server` (server lane exposes it; ask in your outbox if missing).

## Decisions
roundsDone = count of .ai/done-vN.md only (not +1 for DONE.md) · matches IDEA.md and deriveStatus's "Round roundsDone+1" · change readLoopFacts + status.ts together.
state files (.ai/task|log|index) are create-only even with --force · reviewer found --force clobbered loop state · drop `keep` in loadKit.

loop new skips the brief gate and @clack/prompts walkthrough for now · the brief is written after creation (dashboard wizard or by hand); core can add prompts later without changing runNew · add a prompts step in src/cli/index.ts before runNew.
`loop new` removes the folder when gh fails · retry would otherwise fail "already exists" · drop the rm in new.ts.

## Confirmed
- repo.ts readers pass tests/unit/core/repo.test.ts; DONE.md/BLOCKED.md live at repo root, session.lock/task.md/done-vN in .ai/.

## Guesses
(unproven beliefs; never treat one as fact in a later run)

## Tried
(what failed and why, so the next run does not repeat it)

## Don't
- Edit paths another lane owns (CLAUDE.md lane table), except for the "main stays green" fix.
- Add a dependency without a Decisions entry.

## Handoff
Run 1: fixed red main (favicon), shipped unit 1 (src/core/repo.ts). Unit 2 shipped (src/core/brief.ts, exports lintBrief/briefPasses/MIN_BRIEF_SCORE). Unit 3 shipped: src/core/init.ts, src/cli/init.ts (loadKit reads method/operating-card.md, task-template.md, knowledge-index.md, COMPOUNDING_LOOP.md -> .ai/method.md; missing ones warn). Still to add to init once kit ships: check script/tests/runner config install. Unit 5 shipped (src/cli/loops.ts: runStatus/runNextRound/runAnswer; core: rounds.ts, blocked.ts, table.ts). answer commits only task.md+BLOCKED.md, does not push; budget blocks raise the limit by 30. Next: unit 6, `loop run` prompt builder (needs kit's runners/routine/prompt.md; check outbox/kit first). Nothing half-done.
