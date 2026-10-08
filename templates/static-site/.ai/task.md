# TASK: Build v1 of the site described in IDEA.md  (window 1)

Run: 0 / 30

## Contract
<Window 1 writes this from IDEA.md before writing any site code.>
- Goal:
- Done when: `npm test` passes, including a feature test in `tests/` for every "Must have" in IDEA.md, unit tests for every file in `site/js/lib/`, and one page per keyword cluster in IDEA.md.
- Constraints: see CLAUDE.md hard rules.
- Out of scope: everything under "Nice to have" in IDEA.md.

## Current state  (rewrite every window)
- Fresh repo from the starter kit. Nothing built yet.
- Next step: confirm `npm install` and `npm test` work in this environment (GUESS: Playwright's browser download may be blocked in cloud sandboxes; the config then falls back to a system Chrome. If neither works, record it under Decisions and use `npm run check && npm run unit` as the gate). Then write the contract and a plan in `.ai/plans/v1.md` (have a reviewer subagent attack the plan), then build page by page, the main tool first.
- Read first: IDEA.md, CLAUDE.md.

## Decisions  (made without the owner: decision → reason)

## Confirmed  (with how we know)

## Guesses  (test before building on them)

## Tried  (append-only: approach → result → why)

## Don't

## promote?  (for the retro)
