# Concepts

## Operating Card
A short block of rules kept in the always-loaded file (`CLAUDE.md`). It tells every session how to start, size work, record notes, and when to stop. The full method is `.ai/method.md`.

## Task contract
Each medium or large task has a contract: goal, done-when, constraints, out of scope. Done-when items must be checkable by a command. The agent cannot mark work done; the checks do.

## Knowledge
Short notes marked CONFIRMED (proven by a command or test) or GUESS. `.ai/index.md` lists them so a session opens only what is relevant. Notes point to code (`path:line`) and never copy it. A GUESS from an earlier window is never treated as fact.

## Reviewer gate
Before anything is pushed, a subagent that did not write the code checks the diff against the brief: "find the three most likely ways this is wrong for a real user." Blockers are fixed first.

## Session lock
A lock file records that a run is active so a second scheduled run does not collide with a long round. A lock older than 90 minutes is treated as stale.

## Budgets
The task file holds `Run: N / LIMIT`. Each run adds one. At the limit the loop writes `BLOCKED.md` ("run budget reached") and stops.

## Handoff, stuck protocol, retro
- **Handoff:** when context fills up, the run records where it stopped and the exact next step so a fresh run continues at full quality.
- **Stuck protocol:** the same failure twice means stop, not retry a variant. The last step is `BLOCKED.md` with what was tried, the question and a best guess.
- **Retro:** after finishing, record what to keep, change and promote into automated checks.
