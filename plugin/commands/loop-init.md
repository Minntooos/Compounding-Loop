---
description: Set up this repository for the Compounding Loop (operating card, task file, knowledge index)
---

Set this repository up for unattended, verified build loops.

1. If the `loop` CLI is available, run `npx compounding-loop init` and report what it created. Otherwise do the steps below by hand.
2. Make sure these exist, creating only what is missing and never overwriting the user's files:
   - `CLAUDE.md` containing the Operating Card (the "Operating Card (the Compounding Loop)" section).
   - `.ai/method.md`, `.ai/index.md`, `.ai/knowledge/`, `.ai/log.md`.
   - `.ai/task.md` with `Run: 0 / 30`, a Contract with a "Done when" that a command can check, and empty Confirmed, Guesses, Tried and Decisions sections.
3. Ask the user for the one-sentence goal and the command that proves it works (for example `npm test`) if `IDEA.md` or the task contract does not already say.
4. Finish with the exact command the user should run next, and do not start the build yourself.
