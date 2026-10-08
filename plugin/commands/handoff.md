---
description: Write the handoff so a fresh session with zero memory can continue at full quality
---

Run the handoff protocol (method section 9.1) for the current task.

1. Run the checks and record the real result (counts and failing names) in `.ai/task.md` under "Current state".
2. Rewrite "Current state": branch and commit, whether the tree is clean, the single next step, and what to read first (`path:line`, knowledge ids). Do not copy code into the file.
3. Make sure every new fact is under Confirmed (with how we know) or Guesses (with the cheapest test). Move anything half-done into the handoff as "half-done: ...".
4. Commit the task file. Then tell the user the next window is ready and name the first thing it will do.
