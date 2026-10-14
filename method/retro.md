# Retro

Run it when the checks pass, before deleting `.ai/task.md`. About two minutes.

1. List what was learned. For each item: does it apply beyond this task? Is it confirmed or a guess? At what moment would it have helped (file, command or error)?
2. Move general, confirmed items down the promotion ladder as far as they go: `guess → confirmed note → note with a trigger → automated check`. The best memory is one the model never has to read: turn a rule into a lint, test or script and delete the prose.
3. Write each kept lesson as a knowledge entry (`.ai/knowledge/K-NNNN.md`, see `method/example/K-0001.md`) with triggers, and add one line to `.ai/index.md`.
4. Is this a procedure someone will repeat? Then draft a recipe (`loop recipe draft`; see method §7 and `templates/recipe.md`). A repeated *procedure* becomes a recipe; a repeated *mistake* still goes note → trigger → check. For an existing recipe, add or change items; never rewrite the file.
5. Flag entries this task showed to be wrong or stale. Never delete a CONFIRMED entry without new evidence.
6. Add one line to `.ai/log.md`: date, task, checks result, runs used, what was learned.
7. Delete `.ai/task.md`.

## In a lane

- The task file is `.ai/lanes/<lane>/task.md`. Keep it for the record and set `Status:` instead of deleting it (the control room reads it).
- Write knowledge entries and the `.ai/index.md` line only for things that help any lane; put lane-only facts under Confirmed in your task file.
- Before writing your lane's `DONE.md`, read the other lanes' outboxes: if anyone waits on you, answer first.
- If the lesson is about another lane's files, tell them in your outbox. Do not edit their paths.
