---
description: Run the retro after the checks pass - promote lessons, flag stale entries, log the task
---

Run the retro (method section 12) now that the checks pass.

1. Run the checks once more and confirm they pass. If they do not, stop and say so; the task is not done.
2. Read `.ai/task.md`. List the lessons worth keeping beyond this task (Confirmed facts that will bite again, gotchas, decisions). For each, propose a knowledge entry with its triggers (files, error text, commands, topics) and evidence.
3. Flag existing entries in `.ai/index.md` that this task showed to be wrong or stale. Do not delete or rewrite a CONFIRMED entry without new evidence.
4. Add one line to `.ai/log.md`: date, task, checks result, number of windows, what was learned.
5. After the user approves the proposed entries, write them, update `.ai/index.md`, and delete `.ai/task.md`.
