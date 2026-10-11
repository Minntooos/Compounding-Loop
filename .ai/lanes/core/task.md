# Lane: core — round 3 (0.3.0 "Showcase")

Run: 0 / 20
Status: not started
Round 2 record: `.ai/lanes/core/done-v2.md` (`git show 084bb9f:.ai/lanes/core/task.md` for its Decisions).

## Contract
**Goal:** browser-safe parsers for the live demo, and the team commands (IDEA.md Round 3 must-haves 2 and 5).
**Done when:** `npm test` passes; Round 3 audit section with no open blocker; every item below has unit tests.
**Out of scope:** UI, runner prompt files outside `src/core/runPrompt.ts`.

## Units, in order
1. Round 3 re-audit (`.ai/audit/core.md`).
2. Browser-safe pure parsers (no `node:` imports, no fs): lanes.json (reuse the validator), task file (run N/LIMIT, Status, Handoff first line), DONE/BLOCKED presence from a file list, `Lane:` trailer from a commit message. Put them where web and server can both import them (e.g. `src/core/parse/**`); a unit test fails if any file there imports `node:`. Tell server and web the exports in your outbox.
3. `loop claim <lane> [--as <name>] [--minutes 90]` + `loop release <lane>`: write/remove `.ai/lanes/<lane>/claim` (`name · expires <UTC ISO>`), commit with `Lane: <lane>`, push (`--no-push` for tests); default name from `git config user.name`. Expired = none. Refuse to overwrite someone else's unexpired claim without `--force`.
4. `loop next [--json]`: open units per lane from task files (items in "Units, in order" not yet done per the Handoff), claims, DONE lanes skipped, one recommended unclaimed unit. Stable `--json` shape documented in `src/core/types.ts`.
5. Claims in `loop status` (lane block) and in the repo reader the server uses (add a `claim` field to the lane type; tell server).
6. `runPrompt.ts`: the claim rule (CLAUDE.md Round 3 bullet). Then audit majors, then round 2 leftovers from `.ai/done-v2.md` (stale lock after SIGKILL, `.ai/last-test.json` writer) by value.

## Decisions

## Confirmed

## Guesses

## Tried

## Don't
- Edit paths another lane owns, except for the "main stays green" fix.

## Handoff
Round 3 starts here. Brief: IDEA.md "Round 3". Commits carry a `Lane: core` trailer.
