---
description: Run the retro after the checks pass - promote lessons, flag stale entries, log the task
---

Run the retro (method section 12) now that the checks pass.

1. Run the checks once more and confirm they pass. If they do not, stop and say so; the task is not done.
2. Read `.ai/task.md`. List the lessons worth keeping beyond this task (Confirmed facts that will bite again, gotchas, decisions). For each, propose a knowledge entry with its triggers (files, error text, commands, topics) and evidence.
3. Flag existing entries in `.ai/index.md` that this task showed to be wrong or stale. Do not delete or rewrite a CONFIRMED entry without new evidence.
4. Is this a procedure someone will repeat (a kind of project or feature)? Then draft a recipe: run `loop recipe draft --print-prompt`, or `loop recipe draft` if the user agrees to a Claude call. The draft lands in `.ai/recipes/<id>.draft.md` and is scored by `loop recipe check`. For an existing recipe id the draft is a list of added or changed items, never a full rewrite. A repeated *procedure* becomes a recipe; a repeated *mistake* still goes note -> trigger -> check.
5. Add one line to `.ai/log.md`: date, task, checks result, number of windows, what was learned.
6. After the user approves the proposed entries and the recipe draft, write them, update `.ai/index.md`, and delete `.ai/task.md`.
